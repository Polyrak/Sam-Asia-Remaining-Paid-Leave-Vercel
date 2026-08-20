import { readStore, writeStore } from './dataStore.js';

const STORE_NAME = 'employeeOrder';
const DEFAULT_STORE = { order: [] };

export async function getEmployeeOrder() {
  const store = await readStore(STORE_NAME, DEFAULT_STORE);
  return store.order;
}

export async function setEmployeeOrder(order) {
  const store = { order: order.map(String) };
  await writeStore(STORE_NAME, store);
  return store;
}

/**
 * The order list is the curated roster to display, not just a sort hint:
 * employees not listed are left out entirely, since OpenProject project
 * membership can include people outside the group this dashboard tracks.
 * If nothing has been configured yet, falls back to showing everyone so a
 * fresh setup isn't an empty dashboard.
 */
export function applyEmployeeOrder(employees, order) {
  if (!order.length) return employees;
  const rank = new Map(order.map((id, index) => [String(id), index]));
  return employees
    .filter((e) => rank.has(String(e.id)))
    .sort((a, b) => rank.get(String(a.id)) - rank.get(String(b.id)));
}
