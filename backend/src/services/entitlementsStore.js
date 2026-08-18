import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'data', 'entitlements.json');

async function readStore() {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await writeFile(filePath, JSON.stringify(store, null, 2));
}

export async function getEntitlements() {
  return readStore();
}

/**
 * baseDays is the standard annual entitlement; adjustment is a manually
 * tracked correction (e.g. carried-over balance from a prior year, or an HR
 * correction) — it isn't derivable from OpenProject, so it's entered by hand
 * per employee to match whatever ongoing ledger HR maintains. adjustmentNote
 * is optional freeform text (e.g. "17.5 (-0.5)") preserving how HR originally
 * broke the adjustment down, shown instead of the plain number when set.
 */
export async function getEntitlementForUser(userId) {
  const store = await readStore();
  const override = store.overrides[String(userId)];
  const baseDays = override?.baseDays ?? store.defaultBaseDays;
  const adjustment = override?.adjustment ?? 0;
  const adjustmentNote = override?.adjustmentNote ?? null;
  return { baseDays, adjustment, adjustmentNote, total: baseDays + adjustment };
}

export async function setDefaultBaseDays(days) {
  const store = await readStore();
  store.defaultBaseDays = days;
  await writeStore(store);
  return store;
}

export async function setOverride(userId, { baseDays, adjustment, adjustmentNote }) {
  const store = await readStore();
  const existing = store.overrides[String(userId)] ?? {};
  const next = {
    ...(baseDays !== undefined ? { baseDays } : { baseDays: existing.baseDays }),
    ...(adjustment !== undefined ? { adjustment } : { adjustment: existing.adjustment }),
  };
  const note = adjustmentNote !== undefined ? adjustmentNote : existing.adjustmentNote;
  if (note) next.adjustmentNote = note;
  store.overrides[String(userId)] = next;
  await writeStore(store);
  return store;
}

export async function removeOverride(userId) {
  const store = await readStore();
  delete store.overrides[String(userId)];
  await writeStore(store);
  return store;
}
