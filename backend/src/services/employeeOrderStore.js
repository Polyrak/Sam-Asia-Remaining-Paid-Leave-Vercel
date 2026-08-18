import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'data', 'employeeOrder.json');

async function readStore() {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await writeFile(filePath, JSON.stringify(store, null, 2));
}

export async function getEmployeeOrder() {
  const store = await readStore();
  return store.order;
}

export async function setEmployeeOrder(order) {
  const store = { order: order.map(String) };
  await writeStore(store);
  return store;
}

/**
 * Sorts employees by the manually configured order (since OpenProject has no
 * display-order concept for project members); everyone is still shown —
 * anyone not listed keeps their existing relative order, appended after the
 * listed ones.
 */
export function applyEmployeeOrder(employees, order) {
  const rank = new Map(order.map((id, index) => [String(id), index]));
  return [...employees].sort((a, b) => {
    const rankA = rank.has(String(a.id)) ? rank.get(String(a.id)) : Infinity;
    const rankB = rank.has(String(b.id)) ? rank.get(String(b.id)) : Infinity;
    return rankA - rankB;
  });
}
