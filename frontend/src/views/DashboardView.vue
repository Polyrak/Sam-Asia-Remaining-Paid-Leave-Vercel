<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLeaveStore } from '../stores/leave.js';
import { MONTH_LABELS, formatAnnualPl } from '../utils/leaveFormat.js';

const store = useLeaveStore();
const router = useRouter();
const search = ref('');
const page = ref(1);
const exporting = ref(false);

const headers = [
  { title: 'No', key: 'no', sortable: false, width: 56 },
  { title: 'Employee Name', key: 'name', sortable: true },
  { title: 'Annual PL (Day)', key: 'annualPl', sortable: false },
  { title: 'Total PL', key: 'entitlement', align: 'end', sortable: false },
  ...MONTH_LABELS.map((label, i) => ({ title: label, key: `m${i}`, align: 'end', sortable: false })),
  { title: 'Total (day)', key: 'used', align: 'end', sortable: false },
  { title: 'Remaining day', key: 'remaining', align: 'end', sortable: false },
];

const filtered = computed(() =>
  store.summary.map((item, index) => {
    // Computed here (not from the #item.no slot's index) because Vuetify's
    // v-data-table slot index is page-local — it would restart at 1 on every
    // page instead of continuing 11, 12, 13...
    const row = { ...item, no: index + 1, annualPl: formatAnnualPl(item) };
    MONTH_LABELS.forEach((_, i) => {
      const value = item.monthly?.[i] ?? 0;
      row[`m${i}`] = value ? value : '—';
    });
    return row;
  })
);

onMounted(() => store.loadSummary());

watch(search, () => {
  page.value = 1;
});

function refresh() {
  page.value = 1;
  store.loadSummary();
}

function openEmployee(item) {
  router.push({ name: 'employee-detail', params: { id: item.id } });
}

function rowProps({ item }) {
  return item.remaining <= 0 ? { class: 'warning-row' } : {};
}

async function handleExportExcel() {
  exporting.value = true;
  try {
    const { exportLeaveSummaryToExcel } = await import('../services/exportLeave.js');
    await exportLeaveSummaryToExcel(store.summary);
  } finally {
    exporting.value = false;
  }
}

async function handleExportPdf() {
  exporting.value = true;
  try {
    const { exportLeaveSummaryToPdf } = await import('../services/exportLeavePdf.js');
    exportLeaveSummaryToPdf(store.summary);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <v-container fluid>
    <div class="d-flex align-center mb-4 ga-4">
      <h1 class="text-h5"></h1>
      <v-spacer />
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        append-inner-icon="mdi-information-outline"
        label="Search employees"
        density="compact"
        hide-details
        clearable
        variant="outlined"
        style="max-width: 280px"
      >
        <v-tooltip activator="parent" location="top">Searches by employee name only</v-tooltip>
      </v-text-field>
      <v-btn icon="mdi-refresh" :loading="store.loadingSummary" @click="refresh" />
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn prepend-icon="mdi-download" color="primary" :loading="exporting" v-bind="menuProps">
            Export
          </v-btn>
        </template>
        <v-list>
          <v-list-item prepend-icon="mdi-file-excel" title="Export as Excel (.xlsx)" @click="handleExportExcel" />
          <v-list-item prepend-icon="mdi-file-pdf-box" title="Export as PDF" @click="handleExportPdf" />
        </v-list>
      </v-menu>
    </div>

    <v-alert v-if="store.error" type="error" class="mb-4" closable>{{ store.error }}</v-alert>

    <v-card variant="outlined">
      <div style="overflow-x: auto">
        <v-data-table
          v-model:page="page"
          :headers="headers"
          :items="filtered"
          :search="search"
          :filter-keys="['name']"
          :loading="store.loadingSummary"
          :row-props="rowProps"
          hover
          item-value="id"
          @click:row="(_, { item }) => openEmployee(item)"
          style="cursor: pointer; min-width: 1400px"
        >
          <template #item.no="{ item }">{{ item.no }}</template>
          <template #item.annualPl="{ item }">
            <span class="text-no-wrap">{{ item.annualPl }}</span>
          </template>
          <template #item.used="{ item }">
            <span :class="item.used > item.entitlement ? 'text-red' : 'text-green'">{{ item.used }}</span>
          </template>
          <template #item.remaining="{ item }">
            <span :class="item.remaining <= 0 ? 'text-red' : 'text-green'">{{ item.remaining }}</span>
          </template>
        </v-data-table>
      </div>
    </v-card>
  </v-container>
</template>

<style scoped>
:deep(.warning-row) {
  background-color: rgba(var(--v-theme-warning), 0.15) !important;
}
</style>
