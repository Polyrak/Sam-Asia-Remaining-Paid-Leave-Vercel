import { readStore, writeStore } from './dataStore.js';

const STORE_NAME = 'entitlements';
const DEFAULT_STORE = { defaultBaseDays: 18, overrides: {} };

function read() {
  return readStore(STORE_NAME, DEFAULT_STORE);
}

function write(store) {
  return writeStore(STORE_NAME, store);
}

export async function getEntitlements() {
  return read();
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
  const store = await read();
  const override = store.overrides[String(userId)];
  const baseDays = override?.baseDays ?? store.defaultBaseDays;
  const adjustment = override?.adjustment ?? 0;
  const adjustmentNote = override?.adjustmentNote ?? null;
  return { baseDays, adjustment, adjustmentNote, total: baseDays + adjustment };
}

export async function setDefaultBaseDays(days) {
  const store = await read();
  store.defaultBaseDays = days;
  await write(store);
  return store;
}

export async function setOverride(userId, { baseDays, adjustment, adjustmentNote }) {
  const store = await read();
  const existing = store.overrides[String(userId)] ?? {};
  const next = {
    ...(baseDays !== undefined ? { baseDays } : { baseDays: existing.baseDays }),
    ...(adjustment !== undefined ? { adjustment } : { adjustment: existing.adjustment }),
  };
  const note = adjustmentNote !== undefined ? adjustmentNote : existing.adjustmentNote;
  if (note) next.adjustmentNote = note;
  store.overrides[String(userId)] = next;
  await write(store);
  return store;
}

export async function removeOverride(userId) {
  const store = await read();
  delete store.overrides[String(userId)];
  await write(store);
  return store;
}
