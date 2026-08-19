<script setup>
import { useTheme } from 'vuetify';

const theme = useTheme();

function toggleTheme() {
  const next = theme.global.current.value.dark ? 'light' : 'dark';
  theme.global.name.value = next;
  localStorage.setItem('theme', next);
}
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title>
        <router-link to="/dashboard" class="d-flex align-center text-white" style="text-decoration: none">
          <v-icon icon="mdi-calendar-check" class="mr-2" />
          Remaining Paid Leave
        </router-link>
      </v-app-bar-title>
      <v-btn to="/settings">Settings</v-btn>
      <v-btn
        :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        @click="toggleTheme"
      />
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<style>
/* Border only — leaves card title/text at their normal color. */
.v-card--variant-outlined {
  border-color: rgb(var(--v-theme-primary)) !important;
}

/* Same for outlined buttons — the "outlined" variant alone doesn't imply a
   color, so without this every outlined button without an explicit
   color="primary" prop gets a plain/neutral border instead of green. */
.v-btn--variant-outlined {
  border-color: rgb(var(--v-theme-primary)) !important;
}

/* ...except inside the (already green) app bar, where a green border would
   be invisible against the green background — keep those readable instead. */
.v-app-bar .v-btn--variant-outlined {
  border-color: currentColor !important;
}

/* Table header row (Dashboard, employee detail history) — green outline
   (underline) and green text. */
.v-data-table__th {
  border-bottom: 2px solid rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-primary)) !important;
}
.v-data-table__th .v-icon {
  color: rgb(var(--v-theme-primary)) !important;
}

/* Whole pagination bar — "Items per page" label/select, "X-Y of Z" text,
   and the first/prev/next/last page icons — all green. */
.v-data-table-footer,
.v-data-table-footer .v-select__selection,
.v-data-table-footer .v-field__input {
  color: rgb(var(--v-theme-primary)) !important;
}

/* Vuetify truncates card subtitles to a single line with an ellipsis by
   default — our subtitles are often full sentences, so let them wrap. */
.v-card-subtitle {
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: initial !important;
  -webkit-line-clamp: initial !important;
}
</style>
