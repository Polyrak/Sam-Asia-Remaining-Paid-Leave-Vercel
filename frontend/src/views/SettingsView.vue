<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchDiscovery,
  fetchEntitlements,
  setDefaultEntitlement,
  setEntitlementOverride,
  removeEntitlementOverride,
  fetchEmployees,
  fetchEmployeeOrder,
  setEmployeeOrder,
  fetchJoinDates,
  setJoinDate,
  removeJoinDate,
  fetchTimesheetCompliance,
} from '../services/api.js';
import { parseNumberOrSum, formatDate } from '../utils/leaveFormat.js';

const route = useRoute();
const router = useRouter();

// Reflects the active tab in the URL (e.g. /settings?tab=readjustment) so a
// specific tab is shareable/bookmarkable — but navigating here fresh via the
// nav bar's plain "/settings" link (no query) still lands on the first tab.
const VALID_TABS = ['info', 'readjustment'];
const tab = ref(VALID_TABS.includes(route.query.tab) ? route.query.tab : 'info');

watch(
  tab,
  (newTab) => {
    router.replace({ query: { ...route.query, tab: newTab } });
  },
  { immediate: true }
);

const snackbar = ref(false);
const snackbarText = ref('');
function showSuccess(text) {
  snackbarText.value = text;
  snackbar.value = true;
}

const discovery = ref(null);
const discoveryLoading = ref(false);
const discoveryError = ref(null);

const entitlements = ref({ defaultBaseDays: 0, overrides: {} });
const employees = ref([]);
const defaultDays = ref(0);
const overrideUserId = ref(null);
const overrideBaseDays = ref(null);
const overrideAdjustment = ref(null);
const overrideAdjustmentNote = ref(null);
const savingDefault = ref(false);
const savingOverride = ref(false);
const overrideError = ref(null);

const orderError = ref(null);
const orderSaving = ref(false);
const orderLoading = ref(false);
const currentOrderIds = ref([]);
const addEmployeeId = ref(null);

const employeesNotInRoster = computed(() => {
  const rosterIds = new Set(currentOrderIds.value.map(String));
  return employees.value.filter((e) => !rosterIds.has(String(e.id)));
});

const rosterList = computed(() => currentOrderIds.value.map((id) => ({ id, name: employeeName(id) })));

const employeesWithoutOverride = computed(() =>
  employees.value.filter((e) => !(String(e.id) in entitlements.value.overrides))
);

const defaultDaysUnchanged = computed(() => {
  const num = Number(defaultDays.value);
  return defaultDays.value === '' || defaultDays.value === null || !Number.isFinite(num) || num === entitlements.value.defaultBaseDays;
});

const leaveCandidates = computed(() => {
  const wps = discovery.value && discovery.value.leaveWorkPackages;
  return (wps && wps.candidates) || [];
});
const leaveCandidatesMessage = computed(() => {
  const wps = discovery.value && discovery.value.leaveWorkPackages;
  return (wps && wps.message) || null;
});

async function runDiscovery() {
  discoveryLoading.value = true;
  discoveryError.value = null;
  try {
    discovery.value = await fetchDiscovery();
  } catch (err) {
    discoveryError.value = err.response?.data?.message || err.message;
  } finally {
    discoveryLoading.value = false;
  }
}

async function loadEntitlements() {
  entitlements.value = await fetchEntitlements();
  defaultDays.value = entitlements.value.defaultBaseDays;
}

async function saveDefault() {
  savingDefault.value = true;
  try {
    entitlements.value = await setDefaultEntitlement(Number(defaultDays.value));
    showSuccess('Default entitlement saved.');
  } finally {
    savingDefault.value = false;
  }
}

// Returns undefined for "field left blank", a finite number for valid input,
// or NaN for anything that isn't parseable as a single plain number.
function parseOptionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  return Number(value);
}

async function saveOverride() {
  if (!overrideUserId.value) return;
  overrideError.value = null;

  const baseDays = parseOptionalNumber(overrideBaseDays.value);
  if (Number.isNaN(baseDays)) {
    overrideError.value = 'Base days must be a single plain number (e.g. 18 or 19.5).';
    return;
  }

  const parsedAdjustment = parseNumberOrSum(overrideAdjustment.value);
  if (parsedAdjustment === null) {
    overrideError.value =
      'Adjustment must be a number, or numbers added together (e.g. "-7.5" or "24.5 + (-7.5)"). ' +
      "Couldn't make sense of what was entered — check for a bare \"-\" meant as subtraction " +
      '(write it as e.g. "17.5 (-0.5)" instead) or other stray characters.';
    return;
  }

  const explicitNote = overrideAdjustmentNote.value?.trim();
  const adjustmentNote = explicitNote || parsedAdjustment.note || undefined;

  const employeeBeingSaved = employeeName(overrideUserId.value);
  savingOverride.value = true;
  try {
    entitlements.value = await setEntitlementOverride(overrideUserId.value, {
      baseDays,
      adjustment: parsedAdjustment.value,
      adjustmentNote,
    });
    overrideUserId.value = null;
    overrideBaseDays.value = null;
    overrideAdjustment.value = null;
    overrideAdjustmentNote.value = null;
    showSuccess(`Override saved for ${employeeBeingSaved}.`);
  } catch (err) {
    overrideError.value = err.response?.data?.message || err.message;
  } finally {
    savingOverride.value = false;
  }
}

async function clearOverride(userId) {
  const name = employeeName(userId);
  entitlements.value = await removeEntitlementOverride(userId);
  showSuccess(`Override removed for ${name}.`);
}

function employeeName(userId) {
  const employee = employees.value.find((e) => String(e.id) === String(userId));
  return employee ? employee.name : `User ${userId}`;
}

function overrideLabel(override) {
  const base = override.baseDays ?? entitlements.value.defaultBaseDays;
  const adjustment = override.adjustment ?? 0;
  const total = base + adjustment;
  if (override.adjustmentNote) {
    return `${base} + ${override.adjustmentNote} = ${total}`;
  }
  const sign = adjustment < 0 ? '-' : '+';
  return `${base} ${sign} ${Math.abs(adjustment)} = ${total}`;
}

async function loadOrder() {
  orderLoading.value = true;
  try {
    currentOrderIds.value = await fetchEmployeeOrder();
  } finally {
    orderLoading.value = false;
  }
}

async function persistOrder(newOrderIds) {
  orderError.value = null;
  orderSaving.value = true;
  try {
    currentOrderIds.value = await setEmployeeOrder(newOrderIds);
  } catch (err) {
    orderError.value = err.response?.data?.message || err.message;
  } finally {
    orderSaving.value = false;
  }
}

// Always appends to the end — the reliable way to guarantee a newly added
// employee lands last, regardless of list length.
async function addEmployeeToRoster() {
  if (!addEmployeeId.value) return;
  const addedName = employeeName(addEmployeeId.value);
  await persistOrder([...currentOrderIds.value, addEmployeeId.value]);
  addEmployeeId.value = null;
  showSuccess(`Added ${addedName} to the list.`);
}

async function moveRosterItem(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= currentOrderIds.value.length) return;
  const ids = [...currentOrderIds.value];
  [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
  await persistOrder(ids);
}

async function removeFromRoster(id) {
  const name = employeeName(id);
  await persistOrder(currentOrderIds.value.filter((existingId) => String(existingId) !== String(id)));
  showSuccess(`Removed ${name} from the list.`);
}

const joinDates = ref({});
const joinDatesLoading = ref(false);
const joinDateUserId = ref(null);
const joinDateValue = ref(null);
const joinDateSaving = ref(false);
const joinDateError = ref(null);

const compliance = ref(null);
const complianceLoading = ref(false);
const complianceError = ref(null);

const employeesWithoutJoinDate = computed(() =>
  employees.value.filter((e) => !(String(e.id) in joinDates.value))
);

const joinDateList = computed(() =>
  Object.entries(joinDates.value)
    .map(([userId, date]) => ({ userId, date, name: employeeName(userId), tenure: tenureLabel(date) }))
    .sort((a, b) => a.name.localeCompare(b.name))
);

// Mirrors the backend's tenureLabel() so tenure can be shown next to a join
// date immediately, without waiting on the (separately loaded) compliance data.
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

const tenureDialog = ref(false);
const tenureDialogItem = ref(null);

function openTenureDetail(item) {
  tenureDialogItem.value = item;
  tenureDialog.value = true;
}

// Step-by-step version of tenureLabel()'s math, so the user can see exactly
// how "4 yrs 11 mos" was derived from the join date instead of taking it on faith.
const tenureSteps = computed(() => {
  const joinDate = tenureDialogItem.value?.date;
  if (!joinDate) return [];

  const start = new Date(`${joinDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  let months = now.getUTCMonth() - start.getUTCMonth();
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const steps = [{ label: 'Start date', date: start, final: years === 0 && months === 0 }];
  let running = start;

  if (years > 0) {
    running = new Date(Date.UTC(start.getUTCFullYear() + years, start.getUTCMonth(), start.getUTCDate()));
    steps.push({ label: `Add ${years} year${years === 1 ? '' : 's'}`, date: running, final: months === 0 });
  }
  if (months > 0) {
    running = new Date(Date.UTC(running.getUTCFullYear(), running.getUTCMonth() + months, running.getUTCDate()));
    steps.push({ label: `Add ${months} month${months === 1 ? '' : 's'}`, date: running, final: true });
  }
  return steps;
});

function formatStepDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${d}/${m}/${y}`;
}

function dayTooltip(day) {
  if (!day.projects || !day.projects.length) return 'No time entries logged';
  return day.projects.map((p) => `${p.name}: ${p.hours}h`).join(', ');
}

function formatDayHeader(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
  return `${weekday} ${day}`;
}

async function loadJoinDates() {
  joinDatesLoading.value = true;
  try {
    joinDates.value = await fetchJoinDates();
  } finally {
    joinDatesLoading.value = false;
  }
}

async function saveJoinDateHandler() {
  if (!joinDateUserId.value || !joinDateValue.value) return;
  joinDateError.value = null;
  const name = employeeName(joinDateUserId.value);
  joinDateSaving.value = true;
  try {
    joinDates.value = await setJoinDate(joinDateUserId.value, joinDateValue.value);
    joinDateUserId.value = null;
    joinDateValue.value = null;
    showSuccess(`Join date saved for ${name}.`);
    await loadCompliance();
  } catch (err) {
    joinDateError.value = err.response?.data?.message || err.message;
  } finally {
    joinDateSaving.value = false;
  }
}

async function clearJoinDateHandler(userId) {
  const name = employeeName(userId);
  joinDates.value = await removeJoinDate(userId);
  showSuccess(`Join date removed for ${name}.`);
  await loadCompliance();
}

async function loadCompliance() {
  complianceLoading.value = true;
  complianceError.value = null;
  try {
    compliance.value = await fetchTimesheetCompliance();
  } catch (err) {
    complianceError.value = err.response?.data?.message || err.message;
  } finally {
    complianceLoading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadEntitlements(), fetchEmployees().then((e) => (employees.value = e))]);
  await Promise.all([loadOrder(), loadJoinDates(), loadCompliance()]);
});
</script>

<template>
  <v-container fluid style="max-width: 900px">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="router.push({ name: 'dashboard' })">
      Back to dashboard
    </v-btn>
    <h1 class="text-h5 mb-4"></h1>

    <v-tabs v-model="tab" color="primary" class="mb-6">
      <v-tab value="info">Employee Information</v-tab>
      <v-tab value="readjustment">Readjustment employees</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="info">
        <v-card class="mb-6" variant="outlined">
          <v-card-item>
            <v-card-title>Join dates & tenure</v-card-title>
            <v-card-subtitle>
              OpenProject can't reliably supply hire dates — set each employee's join date manually
              to show how long they've been with the company.
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-alert v-if="joinDateError" type="error" class="mb-4" closable @click:close="joinDateError = null">
              {{ joinDateError }}
            </v-alert>

            <v-list
              :loading="joinDatesLoading"
              style="max-height: 260px; overflow-y: auto; border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 4px"
            >
              <v-list-item v-if="!joinDateList.length" class="text-medium-emphasis">
                No join dates set yet.
              </v-list-item>
              <v-list-item
                v-for="item in joinDateList"
                :key="item.userId"
                class="cursor-pointer"
                @click="openTenureDetail(item)"
              >
                <v-list-item-title>
                  {{ item.name }}:
                  <span class="text-primary font-weight-bold">{{ formatDate(item.date) }}</span>
                  <span class="text-medium-emphasis"> ({{ item.tenure }})</span>
                </v-list-item-title>
                <template #append>
                  <v-btn icon="mdi-close" size="small" @click.stop="clearJoinDateHandler(item.userId)" />
                </template>
              </v-list-item>
            </v-list>

            <div class="d-flex align-center ga-4 mt-4 flex-wrap">
              <v-select
                v-model="joinDateUserId"
                :items="employeesWithoutJoinDate.map((e) => ({ title: e.name, value: e.id }))"
                label="Employee"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                style="min-width: 200px; max-width: 260px"
              />
              <v-text-field
                v-model="joinDateValue"
                type="date"
                label="Join date"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                style="min-width: 160px; max-width: 200px"
              />
              <v-btn
                color="primary"
                :disabled="!joinDateUserId || !joinDateValue"
                :loading="joinDateSaving"
                @click="saveJoinDateHandler"
              >
                Save
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-dialog v-model="tenureDialog" max-width="420">
          <v-card v-if="tenureDialogItem">
            <v-card-item>
              <v-card-title>{{ tenureDialogItem.name }}</v-card-title>
              <v-card-subtitle>How the tenure was calculated</v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <div v-for="(step, index) in tenureSteps" :key="index" class="d-flex align-center ga-2 mb-2">
                <v-icon v-if="step.final" icon="mdi-check-circle" color="success" size="small" />
                <v-icon v-else icon="mdi-arrow-right-thin" size="small" class="text-medium-emphasis" />
                <span>{{ step.label }} &rarr;</span>
                <span class="font-weight-bold" :class="step.final ? 'text-success' : 'text-primary'">
                  {{ formatStepDate(step.date) }}
                </span>
              </div>
              <div class="text-medium-emphasis text-caption mt-2">
                Tenure shown as: {{ tenureDialogItem.tenure }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn @click="tenureDialog = false">Close</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Timesheet compliance — this month</v-card-title>
            <v-card-subtitle>
              Checks whether each employee logged exactly {{ (compliance && compliance.hoursPerDay) || 8 }}h on every
              working day so far this month, across all their time entries in every project. Hover a day for the
              project breakdown, click a row for the full month's entries.
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-alert v-if="complianceError" type="error" class="mb-4">{{ complianceError }}</v-alert>
            <v-progress-linear v-if="complianceLoading" indeterminate color="primary" class="mb-4" />

            <div v-if="compliance">
              <v-table density="compact" class="compliance-table">
                <thead>
                  <tr>
                    <th class="text-primary font-weight-bold">Employee Name</th>
                    <th class="text-primary font-weight-bold">Tenure</th>
                    <th
                      v-for="date in compliance.workingDays"
                      :key="date"
                      class="text-primary font-weight-bold text-end"
                    >
                      {{ formatDayHeader(date) }}
                    </th>
                    <th class="text-primary font-weight-bold text-end">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="emp in compliance.employees"
                    :key="emp.id"
                    class="cursor-pointer compliance-row"
                    @click="router.push({ name: 'timesheet-detail', params: { id: emp.id } })"
                  >
                    <td>{{ emp.name }}</td>
                    <td>{{ emp.tenure || '—' }}</td>
                    <td
                      v-for="day in emp.days"
                      :key="day.date"
                      class="text-end"
                      :class="day.compliant ? 'text-green' : 'text-red font-weight-bold'"
                      :title="dayTooltip(day)"
                    >
                      {{ day.hours || '—' }}
                    </td>
                    <td
                      class="text-end"
                      :class="emp.nonCompliantCount > 0 ? 'text-red font-weight-bold' : 'text-green'"
                    >
                      {{ emp.nonCompliantCount }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </v-card-text>
        </v-card>

        <div class="d-flex justify-end mt-4">
          <v-btn prepend-icon="mdi-arrow-left" @click="router.push({ name: 'dashboard' })">
            Back to dashboard
          </v-btn>
        </div>
      </v-window-item>

      <v-window-item value="readjustment">
        <v-card class="mb-6" variant="outlined">
          <v-card-item>
            <v-card-title>OpenProject discovery</v-card-title>
            <v-card-subtitle>
              Find the project id and the "Paid leave" work package id to put in backend/.env
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-btn color="primary" :loading="discoveryLoading" @click="runDiscovery">Run discovery</v-btn>
            <v-alert v-if="discoveryError" type="error" class="mt-4">{{ discoveryError }}</v-alert>

            <div v-if="discovery" class="mt-4">
              <v-expansion-panels multiple variant="accordion">
                <v-expansion-panel title="Projects (find OP_LEAVE_PROJECT_ID)">
                  <v-expansion-panel-text>
                    <div v-for="p in discovery.projects" :key="p.id">
                      #{{ p.id }} — {{ p.name }} ({{ p.identifier }})
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel title="Leave work packages in that project (find OP_PAID_LEAVE_WORK_PACKAGE_ID)">
                  <v-expansion-panel-text>
                    <div v-if="leaveCandidatesMessage">{{ leaveCandidatesMessage }}</div>
                    <div v-for="wp in leaveCandidates" :key="wp.id">
                      #{{ wp.id }} — {{ wp.subject }} ({{ wp.type }})
                    </div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mb-6" variant="outlined">
          <v-card-item>
            <v-card-title>Default annual entitlement</v-card-title>
            <v-card-subtitle>Applies to every employee without an override below</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex align-center ga-4">
            <v-text-field
              v-model="defaultDays"
              type="number"
              label="Base days per year"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              style="min-width: 160px; max-width: 200px"
            />
            <v-btn color="primary" :disabled="defaultDaysUnchanged" :loading="savingDefault" @click="saveDefault">
              Save
            </v-btn>
          </v-card-text>
        </v-card>

        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Per-employee overrides</v-card-title>
            <v-card-subtitle>
              Base days, plus an adjustment (e.g. a carried-over balance) — Adjustment can be a plain
              number or several numbers added together, e.g. "24.5 + (-7.5)"
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-alert v-if="overrideError" type="error" class="mb-4" closable @click:close="overrideError = null">
              {{ overrideError }}
            </v-alert>
            <v-list style="max-height: 260px; overflow-y: auto; border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 4px">
              <v-list-item v-for="(override, userId) in entitlements.overrides" :key="userId">
                <v-list-item-title>
                  {{ employeeName(userId) }}: <span class="text-primary font-weight-bold">{{ overrideLabel(override) }}</span>
                </v-list-item-title>
                <template #append>
                  <v-btn icon="mdi-close" size="small" @click="clearOverride(userId)" />
                </template>
              </v-list-item>
            </v-list>

            <div class="d-flex align-center ga-4 mt-4 flex-wrap">
              <v-select
                v-model="overrideUserId"
                :items="employeesWithoutOverride.map((e) => ({ title: e.name, value: e.id }))"
                label="Employee"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                style="min-width: 200px; max-width: 260px"
              />
              <v-text-field
                v-model="overrideBaseDays"
                inputmode="decimal"
                label="Base days"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                style="min-width: 110px; max-width: 140px"
              />
              <v-text-field
                v-model="overrideAdjustment"
                label="Adjustment"
                placeholder="e.g. -7.5 or 24.5 + (-7.5)"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                style="min-width: 180px; max-width: 220px"
              />
              <div style="min-width: 180px; max-width: 220px" class="position-relative">
                <v-text-field
                  v-model="overrideAdjustmentNote"
                  label="Display as (optional)"
                  placeholder="auto-filled from Adjustment if it's a formula"
                  append-inner-icon="mdi-information-outline"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                />
                <v-tooltip activator="parent" location="top" max-width="260">
                  Only needed to override what's shown — a formula typed in Adjustment is already
                  preserved automatically
                </v-tooltip>
              </div>
              <v-btn color="primary" :disabled="!overrideUserId" :loading="savingOverride" @click="saveOverride">
                Save
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mt-6" variant="outlined">
          <v-card-item>
            <v-card-title>Employee roster & order</v-card-title>
            <v-card-subtitle>
              Only the people listed here show up on the dashboard. Use the arrows to reorder, or the
              × to remove someone — no retyping needed, and every change saves immediately.
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-alert v-if="orderError" type="warning" class="mb-4" closable @click:close="orderError = null">
              {{ orderError }}
            </v-alert>

            <div class="d-flex align-center ga-4 mb-4 flex-wrap">
              <div style="min-width: 260px; max-width: 340px" class="position-relative">
                <v-select
                  v-model="addEmployeeId"
                  :items="employeesNotInRoster.map((e) => ({ title: e.name, value: e.id }))"
                  label="Add employee"
                  append-inner-icon="mdi-information-outline"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                />
                <v-tooltip activator="parent" location="top">Always goes to the end of the list</v-tooltip>
              </div>
              <v-btn color="primary" :disabled="!addEmployeeId" :loading="orderSaving" @click="addEmployeeToRoster">
                Add to list
              </v-btn>
            </div>

            <v-list
              :loading="orderLoading"
              style="max-height: 400px; overflow-y: auto; border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 4px"
            >
              <v-list-item v-for="(item, index) in rosterList" :key="item.id">
                <v-list-item-title>
                  <span class="text-primary font-weight-bold">{{ index + 1 }}.</span> {{ item.name }}
                </v-list-item-title>
                <template #append>
                  <v-btn
                    icon="mdi-arrow-up"
                    size="small"
                    :disabled="index === 0 || orderSaving"
                    @click="moveRosterItem(index, -1)"
                  />
                  <v-btn
                    icon="mdi-arrow-down"
                    size="small"
                    :disabled="index === rosterList.length - 1 || orderSaving"
                    @click="moveRosterItem(index, 1)"
                  />
                  <v-btn icon="mdi-close" size="small" :disabled="orderSaving" @click="removeFromRoster(item.id)" />
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <div class="d-flex justify-end mt-4">
          <v-btn prepend-icon="mdi-arrow-left" @click="router.push({ name: 'dashboard' })">
            Back to dashboard
          </v-btn>
        </div>
      </v-window-item>
    </v-window>

    <v-snackbar v-model="snackbar" color="success" timeout="3000" location="top right">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.compliance-table :deep(table) {
  min-width: 900px;
}

/* Vertical scroll once there are a lot of employees — same wrapper Vuetify
   already scrolls horizontally for the wide Jan-Dec-style day columns. */
.compliance-table :deep(.v-table__wrapper) {
  max-height: 480px;
  overflow-y: auto;
}

.compliance-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(var(--v-theme-surface));
}

.compliance-table :deep(.compliance-row:hover) {
  background: rgba(var(--v-theme-primary), 0.08);
}

.compliance-table :deep(th),
.compliance-table :deep(td) {
  white-space: nowrap;
}
</style>
