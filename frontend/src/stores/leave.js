import { defineStore } from 'pinia';
import { fetchLeaveSummary, fetchLeaveRequests } from '../services/api.js';

export const useLeaveStore = defineStore('leave', {
  state: () => ({
    summary: [],
    requestsByUser: {},
    loadingSummary: false,
    loadingRequests: false,
    error: null,
  }),
  getters: {
    employeeById: (state) => (id) => state.summary.find((e) => String(e.id) === String(id)),
  },
  actions: {
    async loadSummary() {
      this.loadingSummary = true;
      this.error = null;
      try {
        this.summary = await fetchLeaveSummary();
      } catch (err) {
        this.error = err.response?.data?.message || err.message;
      } finally {
        this.loadingSummary = false;
      }
    },
    async loadRequestsForUser(userId) {
      this.loadingRequests = true;
      this.error = null;
      try {
        this.requestsByUser[userId] = await fetchLeaveRequests(userId);
      } catch (err) {
        this.error = err.response?.data?.message || err.message;
      } finally {
        this.loadingRequests = false;
      }
    },
  },
});
