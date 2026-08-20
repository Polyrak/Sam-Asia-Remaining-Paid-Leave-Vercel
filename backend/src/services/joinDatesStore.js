import { readStore, writeStore } from './dataStore.js';

const STORE_NAME = 'joinDates';
const DEFAULT_STORE = {};

export async function getJoinDates() {
  return readStore(STORE_NAME, DEFAULT_STORE);
}

export async function getJoinDateForUser(userId) {
  const store = await readStore(STORE_NAME, DEFAULT_STORE);
  return store[String(userId)] ?? null;
}

export async function setJoinDate(userId, date) {
  const store = await readStore(STORE_NAME, DEFAULT_STORE);
  store[String(userId)] = date;
  await writeStore(STORE_NAME, store);
  return store;
}

export async function removeJoinDate(userId) {
  const store = await readStore(STORE_NAME, DEFAULT_STORE);
  delete store[String(userId)];
  await writeStore(STORE_NAME, store);
  return store;
}
