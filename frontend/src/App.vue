<script setup>
import { useTheme } from 'vuetify';

const theme = useTheme();

function toggleTheme() {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark';
}
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title>
        <v-icon icon="mdi-calendar-check" class="mr-2" />
        Remaining Paid Leave
      </v-app-bar-title>
      <v-btn to="/" variant="text">Dashboard</v-btn>
      <v-btn to="/settings" variant="text">Settings</v-btn>
      <v-btn
        :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        @click="toggleTheme"
      />
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
