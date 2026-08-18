<script setup>
import { computed } from 'vue';

const props = defineProps({
  entitlement: { type: Number, required: true },
  remaining: { type: Number, required: true },
});

const ratio = computed(() => (props.entitlement > 0 ? props.remaining / props.entitlement : 0));

const color = computed(() => {
  if (props.remaining < 0) return 'red';
  if (ratio.value < 0.25) return 'orange';
  return 'green';
});

const percent = computed(() => Math.max(0, Math.min(100, ratio.value * 100)));
</script>

<template>
  <div class="d-flex align-center ga-2">
    <v-progress-linear
      :model-value="percent"
      :color="color"
      height="10"
      rounded
      style="max-width: 120px"
    />
    <span :class="`text-${color}`">{{ remaining }}</span>
  </div>
</template>
