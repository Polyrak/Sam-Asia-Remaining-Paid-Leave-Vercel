import { config } from '../config.js';
import { fetchAllPages } from '../openProjectClient.js';
import { withCache } from '../cache.js';
import { getEntitlementForUser } from './entitlementsStore.js';
import { getEmployeeOrder, applyEmployeeOrder } from './employeeOrderStore.js';
import { getJoinDateForUser } from './joinDatesStore.js';

function idFromHref(href) {
  if (!href) return null;
  const match = href.match(/\/(\d+)$/);
  return match ? match[1] : null;
}

// OpenProject reports spent time as an ISO 8601 duration, e.g. "PT8H", "PT4H30M",
// or "PT3H25M42S" — seconds show up whenever an entry wasn't logged in round minutes.
function isoDurationToHours(iso) {
  const match = String(iso ?? '').match(
    /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/
  );
  if (!match) return 0;
  return parseFloat(match[1] || '0') + parseFloat(match[2] || '0') / 60 + parseFloat(match[3] || '0') / 3600;
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return [`${year}-01-01`, `${year}-12-31`];
}

/** Calendar days from the 1st of the current month through today. */
function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return [from, to];
}

/**
 * Employees are the members of the configured project, fetched via project
 * memberships rather than the global /users list: OpenProject only lets an
 * ordinary API key see users it shares a project with, not every user in the
 * instance. Groups (non-user principals) are filtered out.
 */
export async function getEmployees() {
  if (!config.leave.projectId) {
    throw new Error('OP_LEAVE_PROJECT_ID is not configured. Visit Settings and run discovery first.');
  }
  return withCache(`employees:${config.leave.projectId}`, config.cacheTtlSeconds, async () => {
    const memberships = await fetchAllPages('/memberships', {
      filters: [{ project: { operator: '=', values: [String(config.leave.projectId)] } }],
    });

    const byId = new Map();
    for (const membership of memberships) {
      const href = membership._links?.principal?.href ?? '';
      if (!href.startsWith('/api/v3/users/')) continue; // skip groups
      const id = idFromHref(href);
      if (!id || byId.has(id)) continue;
      byId.set(id, { id, name: membership._links.principal.title });
    }
    return [...byId.values()];
  });
}

function mapTimeEntry(entry) {
  return {
    id: entry.id,
    date: entry.spentOn ?? null,
    days: isoDurationToHours(entry.hours) / config.leave.hoursPerDay,
    comment: entry.comment?.raw ?? '',
    userId: idFromHref(entry._links?.user?.href),
    userName: entry._links?.user?.title ?? null,
  };
}

/**
 * Paid-leave time entries logged against the configured "Paid leave" work
 * package. Scoped to the current year by default, since annual entitlement
 * resets yearly.
 */
export async function getPaidLeaveEntries({ userId, year } = {}) {
  if (!config.leave.paidLeaveWorkPackageId) {
    throw new Error('OP_PAID_LEAVE_WORK_PACKAGE_ID is not configured. Visit Settings and run discovery first.');
  }
  const [from, to] = year
    ? [`${year}-01-01`, `${year}-12-31`]
    : currentYearRange();

  const filters = [
    { work_package: { operator: '=', values: [String(config.leave.paidLeaveWorkPackageId)] } },
    { spentOn: { operator: '<>d', values: [from, to] } },
  ];
  if (userId) {
    filters.push({ user: { operator: '=', values: [String(userId)] } });
  }

  const cacheKey = `paid-leave-entries:${userId ?? 'all'}:${from}`;
  return withCache(cacheKey, config.cacheTtlSeconds, async () => {
    const elements = await fetchAllPages('/time_entries', { filters });
    return elements.map(mapTimeEntry);
  });
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Per-employee days used in each calendar month of the given year, e.g.
 * { "36": [1.5, 0.5, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0] } (index 0 = January).
 */
function aggregateMonthlyUsageByUser(entries) {
  const byUser = new Map();
  for (const entry of entries) {
    if (!entry.userId || !entry.date) continue;
    const month = Number(entry.date.slice(5, 7)) - 1;
    if (!byUser.has(entry.userId)) byUser.set(entry.userId, new Array(12).fill(0));
    byUser.get(entry.userId)[month] += entry.days;
  }
  return byUser;
}

export async function computeLeaveSummary() {
  const currentYear = new Date().getFullYear();
  const [unorderedEmployees, entries, order] = await Promise.all([
    getEmployees(),
    getPaidLeaveEntries({ year: currentYear }),
    getEmployeeOrder(),
  ]);
  const employees = applyEmployeeOrder(unorderedEmployees, order);

  const monthlyByUser = aggregateMonthlyUsageByUser(entries);

  const summary = [];
  for (const employee of employees) {
    const { baseDays, adjustment, adjustmentNote, total: entitlement } = await getEntitlementForUser(employee.id);
    const monthly = (monthlyByUser.get(String(employee.id)) ?? new Array(12).fill(0)).map(round2);
    const used = round2(monthly.reduce((sum, days) => sum + days, 0));

    summary.push({
      ...employee,
      baseDays,
      adjustment,
      adjustmentNote,
      entitlement,
      monthly,
      used,
      remaining: round2(entitlement - used),
    });
  }
  return summary;
}

/** Working weekdays (Mon-Fri) from the 1st of the current month through today. */
function currentMonthWorkingDaysSoFar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const days = [];
  for (let day = 1; day <= today; day++) {
    const date = new Date(Date.UTC(year, month, day));
    const dow = date.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

function tenureLabel(joinDate) {
  if (!joinDate) return null;
  const start = new Date(`${joinDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  let months = now.getUTCMonth() - start.getUTCMonth();
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (months > 0 || years === 0) parts.push(`${months} mo${months === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/**
 * For every employee in the roster: their tenure (from a manually entered
 * join date, since OpenProject can't supply this) and a day-by-day check of
 * whether they logged exactly OP_HOURS_PER_DAY on each working day so far
 * this month, across ALL their time entries (not just paid leave) — a day
 * spent entirely on leave still counts as "filled correctly".
 */
export async function getMonthlyTimesheetCompliance() {
  const workingDays = currentMonthWorkingDaysSoFar();
  const order = await getEmployeeOrder();
  const employees = applyEmployeeOrder(await getEmployees(), order);

  const from = workingDays[0] ?? new Date().toISOString().slice(0, 10);
  const to = workingDays[workingDays.length - 1] ?? from;

  const filters = [
    { user: { operator: '=', values: employees.map((e) => String(e.id)) } },
    { spentOn: { operator: '<>d', values: [from, to] } },
  ];
  const entries = employees.length
    ? await withCache(`timesheet:${from}:${to}`, config.cacheTtlSeconds, () =>
        fetchAllPages('/time_entries', { filters })
      )
    : [];

  // Per user, per day: total hours, and hours broken down by project (so a
  // day's total can be explained without opening the full detail page).
  const hoursByUserDay = new Map();
  const projectsByUserDay = new Map();
  for (const entry of entries) {
    const userId = idFromHref(entry._links?.user?.href);
    if (!userId || !entry.spentOn) continue;
    const hours = isoDurationToHours(entry.hours);

    if (!hoursByUserDay.has(userId)) hoursByUserDay.set(userId, new Map());
    const dayMap = hoursByUserDay.get(userId);
    dayMap.set(entry.spentOn, (dayMap.get(entry.spentOn) ?? 0) + hours);

    const projectName = entry._links?.project?.title ?? 'Unknown project';
    if (!projectsByUserDay.has(userId)) projectsByUserDay.set(userId, new Map());
    const userProjectDays = projectsByUserDay.get(userId);
    if (!userProjectDays.has(entry.spentOn)) userProjectDays.set(entry.spentOn, new Map());
    const projectMap = userProjectDays.get(entry.spentOn);
    projectMap.set(projectName, (projectMap.get(projectName) ?? 0) + hours);
  }

  const results = [];
  for (const employee of employees) {
    const joinDate = await getJoinDateForUser(employee.id);
    const dayMap = hoursByUserDay.get(String(employee.id)) ?? new Map();
    const userProjectDays = projectsByUserDay.get(String(employee.id));
    const days = workingDays.map((date) => {
      const hours = round2(dayMap.get(date) ?? 0);
      const projectMap = userProjectDays?.get(date);
      const projects = projectMap
        ? [...projectMap.entries()]
            .filter(([, h]) => h > 0)
            .map(([name, h]) => ({ name, hours: round2(h) }))
        : [];
      return { date, hours, compliant: hours === config.leave.hoursPerDay, projects };
    });
    results.push({
      ...employee,
      joinDate,
      tenure: tenureLabel(joinDate),
      days,
      nonCompliantCount: days.filter((d) => !d.compliant).length,
    });
  }

  return { workingDays, hoursPerDay: config.leave.hoursPerDay, employees: results };
}

/**
 * Every time entry a single employee logged this month (1st of the month
 * through today, across all projects), for the "where did these hours come
 * from" drill-down behind the timesheet compliance table.
 */
export async function getMonthlyTimeEntriesForUser(userId) {
  const [from, to] = currentMonthRange();
  const employees = await getEmployees();
  const employee = employees.find((e) => String(e.id) === String(userId));
  const joinDate = await getJoinDateForUser(userId);

  const filters = [
    { user: { operator: '=', values: [String(userId)] } },
    { spentOn: { operator: '<>d', values: [from, to] } },
  ];
  const entries = await withCache(`timesheet-detail:${userId}:${from}:${to}`, config.cacheTtlSeconds, () =>
    fetchAllPages('/time_entries', { filters })
  );

  const mapped = entries
    .map((entry) => ({
      id: entry.id,
      date: entry.spentOn,
      hours: round2(isoDurationToHours(entry.hours)),
      project: entry._links?.project?.title ?? null,
      workPackage: entry._links?.workPackage?.title ?? null,
      activity: entry._links?.activity?.title ?? null,
      comment: entry.comment?.raw ?? '',
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id - b.id));

  return {
    userId: String(userId),
    name: employee ? employee.name : `User ${userId}`,
    tenure: tenureLabel(joinDate),
    from,
    to,
    hoursPerDay: config.leave.hoursPerDay,
    entries: mapped,
  };
}

async function discoverLeaveWorkPackages(projectId) {
  if (!projectId) {
    return { message: 'Pick a project below first, set OP_LEAVE_PROJECT_ID, then re-run discovery.' };
  }
  const workPackages = await fetchAllPages('/work_packages', {
    filters: [{ project: { operator: '=', values: [String(projectId)] } }],
    pageSize: 200,
  });
  const typeName = (wp) => wp._embedded?.type?.name ?? wp._links?.type?.title ?? null;
  const candidates = workPackages
    .filter((wp) => /leave|holiday/i.test(wp.subject ?? '') || /leave/i.test(typeName(wp) ?? ''))
    .map((wp) => ({ id: wp.id, subject: wp.subject, type: typeName(wp) }));
  return { candidates };
}

export async function discoverConfiguration() {
  const [projects, leaveWorkPackages] = await Promise.all([
    fetchAllPages('/projects'),
    discoverLeaveWorkPackages(config.leave.projectId),
  ]);

  return {
    projects: projects.map((p) => ({ id: p.id, identifier: p.identifier, name: p.name })),
    leaveWorkPackages,
    currentConfig: config.leave,
  };
}
