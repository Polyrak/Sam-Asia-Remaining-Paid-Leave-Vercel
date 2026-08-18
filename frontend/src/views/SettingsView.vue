<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  fetchDiscovery,
  fetchEntitlements,
  setDefaultEntitlement,
  setEntitlementOverride,
  removeEntitlementOverride,
  fetchEmployees,
  fetchEmployeeOrder,
  setEmployeeOrder,
} from '../services/api.js';
import { parseNumberOrSum } from '../utils/leaveFormat.js';

const router = useRouter();

const tab = ref('readjustment');

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

const orderText = ref('');
const orderError = ref(null);
const orderSaving = ref(false);
const orderLoading = ref(false);

const employeesWithoutOverride = computed(() =>
  employees.value.filter((e) => !(String(e.id) in entitlements.value.overrides))
);

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
  } catch (err) {
    overrideError.value = err.response?.data?.message || err.message;
  } finally {
    savingOverride.value = false;
  }
}

async function clearOverride(userId) {
  entitlements.value = await removeEntitlementOverride(userId);
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

function orderedNames(empList, order) {
  const byId = new Map(empList.map((e) => [String(e.id), e]));
  const rank = new Map(order.map((id, index) => [String(id), index]));
  const sorted = [...empList].sort((a, b) => {
    const rankA = rank.has(String(a.id)) ? rank.get(String(a.id)) : Infinity;
    const rankB = rank.has(String(b.id)) ? rank.get(String(b.id)) : Infinity;
    return rankA - rankB;
  });
  return sorted.map((e) => byId.get(String(e.id)).name);
}

async function loadOrder() {
  orderLoading.value = true;
  try {
    const order = await fetchEmployeeOrder();
    orderText.value = orderedNames(employees.value, order).join('\n');
  } finally {
    orderLoading.value = false;
  }
}

async function saveOrder() {
  orderError.value = null;
  const names = orderText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const ids = [];
  const unmatched = [];
  for (const name of names) {
    const employee = employees.value.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (employee) {
      ids.push(employee.id);
    } else {
      unmatched.push(name);
    }
  }

  if (unmatched.length) {
    orderError.value = `Couldn't match these names to an employee, so they were skipped: ${unmatched.join(', ')}`;
  }

  orderSaving.value = true;
  try {
    const order = await setEmployeeOrder(ids);
    orderText.value = orderedNames(employees.value, order).join('\n');
  } finally {
    orderSaving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadEntitlements(), fetchEmployees().then((e) => (employees.value = e))]);
  await loadOrder();
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
        <v-card variant="outlined">
          <v-card-text class="text-center text-medium-emphasis py-12"> Coming soon. </v-card-text>
        </v-card>
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
              style="max-width: 160px"
            />
            <v-btn color="primary" :loading="savingDefault" @click="saveDefault">Save</v-btn>
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
                <v-list-item-title>{{ employeeName(userId) }}: {{ overrideLabel(override) }}</v-list-item-title>
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
                style="max-width: 260px"
              />
              <v-text-field
                v-model="overrideBaseDays"
                inputmode="decimal"
                label="Base days"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 140px"
              />
              <v-text-field
                v-model="overrideAdjustment"
                label="Adjustment"
                placeholder="e.g. -7.5 or 24.5 + (-7.5)"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 220px"
              />
              <v-text-field
                v-model="overrideAdjustmentNote"
                label="Display as (optional)"
                placeholder="auto-filled from Adjustment if it's a formula"
                append-inner-icon="mdi-information-outline"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 200px"
              >
                <v-tooltip activator="parent" location="top" max-width="260">
                  Only needed to override what's shown — a formula typed in Adjustment is already
                  preserved automatically
                </v-tooltip>
              </v-text-field>
              <v-btn color="primary" :loading="savingOverride" @click="saveOverride">Save</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mt-6" variant="outlined">
          <v-card-item>
            <v-card-title>Display order</v-card-title>
            <v-card-subtitle>
              One employee name per line, in the order they should appear on the dashboard. Everyone is
              shown regardless — anyone left out of this list is added at the end automatically.
            </v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-alert v-if="orderError" type="warning" class="mb-4" closable @click:close="orderError = null">
              {{ orderError }}
            </v-alert>
            <v-textarea v-model="orderText" :loading="orderLoading" rows="10" variant="outlined" hide-details />
            <v-btn color="primary" class="mt-4" :loading="orderSaving" @click="saveOrder">Save</v-btn>
          </v-card-text>
        </v-card>
      </v-window-item>
    </v-window>
  </v-container>
</template>
