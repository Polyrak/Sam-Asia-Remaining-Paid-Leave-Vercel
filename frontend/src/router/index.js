import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import EmployeeDetailView from '../views/EmployeeDetailView.vue';
import SettingsView from '../views/SettingsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/employees/:id', name: 'employee-detail', component: EmployeeDetailView, props: true },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
});
