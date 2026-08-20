<script setup>
import { useTheme } from 'vuetify';
import { useRouter } from 'vue-router';

const theme = useTheme();
const router = useRouter();

function toggleTheme() {
  const next = theme.global.current.value.dark ? 'light' : 'dark';
  theme.global.name.value = next;
  localStorage.setItem('theme', next);
}
</script>

<template>
  <v-app>
    <v-app-bar density="comfortable">
      <v-app-bar-title>
        <router-link to="/dashboard" class="d-flex align-center text-primary" style="text-decoration: none">
          <v-icon icon="mdi-calendar-check" class="mr-2" />
          Remaining Paid Leave
        </router-link>
      </v-app-bar-title>
      <v-menu open-on-hover>
        <template #activator="{ props: menuProps }">
          <v-btn icon="mdi-chevron-down" v-bind="menuProps" />
        </template>
        <v-list>
          <v-list-item prepend-icon="mdi-cog" title="Settings" @click="router.push({ name: 'settings' })" />
        </v-list>
      </v-menu>
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

/* Text fields / selects: Vuetify only colors an outlined field's border
   green while it's focused, and falls back to a neutral gray otherwise —
   force it green all the time, matching the buttons/cards above. */
.v-field--variant-outlined .v-field__outline {
  color: rgb(var(--v-theme-primary)) !important;
}

/* Every icon green by default... */
.v-icon {
  color: rgb(var(--v-theme-primary)) !important;
}

/* ...except inside alerts, where an error/warning alert needs its own icon
   color to stay meaningful instead of turning green. */
.v-alert .v-icon {
  color: currentColor !important;
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

/* Top app bar — same look as a table header: light background, green text,
   green underline — instead of a solid green banner. */
.v-app-bar {
  border-bottom: 2px solid rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-primary)) !important;
}

/* A native <input type="date">'s calendar icon isn't a Vuetify v-icon, so
   the rule above can't reach it — recolor it directly (WebKit/Blink only;
   Firefox's date input doesn't expose a stylable picker icon). */
input[type='date']::-webkit-calendar-picker-indicator {
  filter: invert(48%) sepia(93%) saturate(1352%) hue-rotate(93deg) brightness(94%) contrast(93%);
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
