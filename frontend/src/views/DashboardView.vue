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
  { title: 'Employee Name', key: 'name' },
  { title: 'Annual PL (Day)', key: 'annualPl' },
  { title: 'Total PL', key: 'entitlement', align: 'end' },
  ...MONTH_LABELS.map((label, i) => ({ title: label, key: `m${i}`, align: 'end', sortable: false })),
  { title: 'Total (day)', key: 'used', align: 'end' },
  { title: 'Remaining day', key: 'remaining', align: 'end' },
];

const filtered = computed(() =>
  store.summary.map((item) => {
    const row = { ...item, annualPl: formatAnnualPl(item) };
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
      <h1 class="text-h5">Remaining Paid Leave</h1>
      <v-spacer />
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Search employees"
        density="compact"
        hide-details
        clearable
        variant="outlined"
        style="max-width: 280px"
      />
      <v-btn icon="mdi-refresh" variant="text" :loading="store.loadingSummary" @click="refresh" />
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn prepend-icon="mdi-download" variant="tonal" color="green" :loading="exporting" v-bind="menuProps">
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

    <v-card>
      <div style="overflow-x: auto">
        <v-data-table
          v-model:page="page"
          :headers="headers"
          :items="filtered"
          :search="search"
          :loading="store.loadingSummary"
          item-value="id"
          @click:row="(_, { item }) => openEmployee(item)"
          style="cursor: pointer; min-width: 1400px"
        >
          <template #item.no="{ index }">{{ index + 1 }}</template>
          <template #item.annualPl="{ item }">
            <span class="text-no-wrap">{{ item.annualPl }}</span>
          </template>
        </v-data-table>
      </div>
    </v-card>
  </v-container>
</template>
