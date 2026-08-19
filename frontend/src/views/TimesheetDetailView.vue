<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { fetchTimesheetDetail } from '../services/api.js';
import { formatDate } from '../utils/leaveFormat.js';

const props = defineProps({
  id: { type: String, required: true },
});

const router = useRouter();

const detail = ref(null);
const loading = ref(false);
const error = ref(null);

const totalHours = computed(() => {
  if (!detail.value) return 0;
  return Math.round(detail.value.entries.reduce((sum, e) => sum + e.hours, 0) * 100) / 100;
});

const headers = [
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Project', key: 'project' },
  { title: 'Work package', key: 'workPackage' },
  { title: 'Activity', key: 'activity' },
  { title: 'Hours', key: 'hours', align: 'end' },
  { title: 'Comment', key: 'comment' },
];

async function load() {
  loading.value = true;
  error.value = null;
  try {
    detail.value = await fetchTimesheetDetail(props.id);
  } catch (err) {
    error.value = err.response?.data?.message || err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-container fluid>
    <v-btn
      variant="text"
      prepend-icon="mdi-arrow-left"
      class="mb-4"
      @click="router.push({ name: 'settings', query: { tab: 'info' } })"
    >
      Back to Employee Information
    </v-btn>

    <v-alert v-if="error" type="error" class="mb-4" closable @click:close="error = null">{{ error }}</v-alert>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-card v-if="detail" class="mb-4" variant="outlined">
      <v-card-item>
        <v-card-title>{{ detail.name }}</v-card-title>
        <v-card-subtitle v-if="detail.tenure">Tenure: {{ detail.tenure }}</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis">Period</div>
            <div class="text-h6">{{ formatDate(detail.from) }} - {{ formatDate(detail.to) }}</div>
          </v-col>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis">Total hours logged</div>
            <div class="text-h6">{{ totalHours }}h</div>
          </v-col>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis">Expected per working day</div>
            <div class="text-h6">{{ detail.hoursPerDay }}h</div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card variant="outlined">
      <v-card-title class="text-subtitle-1">Time entries this month</v-card-title>
      <v-data-table :headers="headers" :items="detail ? detail.entries : []" :loading="loading" item-value="id">
        <template #item.date="{ item }">
          <span class="text-no-wrap">{{ formatDate(item.date) }}</span>
        </template>
        <template #item.hours="{ item }">
          <span class="font-weight-bold">{{ item.hours }}</span>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>
