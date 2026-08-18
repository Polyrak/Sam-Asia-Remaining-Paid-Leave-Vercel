import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

export async function fetchHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function fetchLeaveSummary() {
  const { data } = await api.get('/leave-summary');
  return data;
}

export async function fetchEmployees() {
  const { data } = await api.get('/employees');
  return data;
}

export async function fetchLeaveRequests(userId) {
  const { data } = await api.get('/leave-requests', { params: { userId } });
  return data;
}

export async function fetchDiscovery() {
  const { data } = await api.get('/discover');
  return data;
}

export async function fetchEntitlements() {
  const { data } = await api.get('/entitlements');
  return data;
}

export async function setDefaultEntitlement(baseDays) {
  const { data } = await api.put('/entitlements/default', { baseDays });
  return data;
}

export async function setEntitlementOverride(userId, { baseDays, adjustment, adjustmentNote }) {
  const { data } = await api.put(`/entitlements/${userId}`, { baseDays, adjustment, adjustmentNote });
  return data;
}

export async function removeEntitlementOverride(userId) {
  const { data } = await api.delete(`/entitlements/${userId}`);
  return data;
}

export async function fetchEmployeeOrder() {
  const { data } = await api.get('/employee-order');
  return data.order;
}

export async function setEmployeeOrder(order) {
  const { data } = await api.put('/employee-order', { order });
  return data.order;
}
