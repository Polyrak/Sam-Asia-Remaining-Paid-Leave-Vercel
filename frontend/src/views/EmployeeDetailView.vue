<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useLeaveStore } from '../stores/leave.js';
import RemainingProgress from '../components/RemainingProgress.vue';
import { formatDate } from '../utils/leaveFormat.js';

const props = defineProps({
  id: { type: String, required: true },
});

const store = useLeaveStore();
const router = useRouter();

const employee = computed(() => store.employeeById(props.id));
const entries = computed(() => store.requestsByUser[props.id] ?? []);

const annualPlLabel = computed(() => {
  if (!employee.value) return '';
  if (employee.value.adjustmentNote) {
    return `${employee.value.baseDays} base + ${employee.value.adjustmentNote} adjustment`;
  }
  const sign = employee.value.adjustment < 0 ? '-' : '+';
  return `${employee.value.baseDays} base ${sign} ${Math.abs(employee.value.adjustment)} adjustment`;
});

const headers = [
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Days', key: 'days', align: 'end' },
  { title: 'Note', key: 'comment' },
];

onMounted(async () => {
  if (!store.summary.length) await store.loadSummary();
  await store.loadRequestsForUser(props.id);
});
</script>

<template>
  <v-container fluid>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="router.push({ name: 'dashboard' })">
      Back to dashboard
    </v-btn>

    <v-alert v-if="store.error" type="error" class="mb-4" closable>{{ store.error }}</v-alert>

    <v-card v-if="employee" class="mb-4" variant="outlined">
      <v-card-item>
        <v-card-title>{{ employee.name }}</v-card-title>
      </v-card-item>
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis">Entitlement</div>
            <div class="text-h6">{{ employee.entitlement }} days</div>
            <div class="text-caption text-medium-emphasis">{{ annualPlLabel }}</div>
          </v-col>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis">Used (this year)</div>
            <div class="text-h6">{{ employee.used }} days</div>
          </v-col>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis">Remaining</div>
            <RemainingProgress :entitlement="employee.entitlement" :remaining="employee.remaining" />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card variant="outlined">
      <v-card-title class="text-subtitle-1">Paid leave taken this year</v-card-title>
      <v-data-table :headers="headers" :items="entries" :loading="store.loadingRequests" item-value="id">
        <template #item.date="{ item }">
          <span class="text-no-wrap">{{ formatDate(item.date) }}</span>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>
