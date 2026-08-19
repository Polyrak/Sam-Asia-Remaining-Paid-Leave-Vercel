import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'data', 'joinDates.json');

async function readStore() {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await writeFile(filePath, JSON.stringify(store, null, 2));
}

export async function getJoinDates() {
  return readStore();
}

export async function getJoinDateForUser(userId) {
  const store = await readStore();
  return store[String(userId)] ?? null;
}

export async function setJoinDate(userId, date) {
  const store = await readStore();
  store[String(userId)] = date;
  await writeStore(store);
  return store;
}

export async function removeJoinDate(userId) {
  const store = await readStore();
  delete store[String(userId)];
  await writeStore(store);
  return store;
}
