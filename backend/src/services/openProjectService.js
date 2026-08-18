import { config } from '../config.js';
import { fetchAllPages } from '../openProjectClient.js';
import { withCache } from '../cache.js';
import { getEntitlementForUser } from './entitlementsStore.js';
import { getEmployeeOrder, applyEmployeeOrder } from './employeeOrderStore.js';

function idFromHref(href) {
  if (!href) return null;
  const match = href.match(/\/(\d+)$/);
  return match ? match[1] : null;
}

// OpenProject reports spent time as an ISO 8601 duration, e.g. "PT8H" or "PT4H30M".
function isoDurationToHours(iso) {
  const match = String(iso ?? '').match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?$/);
  if (!match) return 0;
  return parseFloat(match[1] || '0') + parseFloat(match[2] || '0') / 60;
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return [`${year}-01-01`, `${year}-12-31`];
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
