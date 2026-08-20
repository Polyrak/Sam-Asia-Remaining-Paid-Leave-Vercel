// One-time migration: copies the local JSON files under src/data into
// Vercel KV, so the entitlements/roster/join-dates you've already entered
// locally aren't lost when the app starts reading from KV in production.
//
// Run this AFTER connecting a KV/Redis integration to your Vercel project
// and pulling its env vars locally (`vercel env pull .env.local` from the
// backend directory, or copy KV_REST_API_URL / KV_REST_API_TOKEN into
// backend/.env by hand). Safe to run more than once — it just overwrites
// the three keys with the current contents of the local JSON files.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'src', 'data');

if (!process.env.KV_REST_API_URL) {
  console.error('KV_REST_API_URL is not set — pull your KV env vars first (see comment at the top of this file).');
  process.exit(1);
}

const { kv } = await import('@vercel/kv');

const files = [
  { name: 'entitlements', file: 'entitlements.json' },
  { name: 'employeeOrder', file: 'employeeOrder.json' },
  { name: 'joinDates', file: 'joinDates.json' },
];

for (const { name, file } of files) {
  try {
    const raw = await readFile(path.join(dataDir, file), 'utf-8');
    const value = JSON.parse(raw);
    await kv.set(name, value);
    console.log(`Migrated ${file} -> KV key "${name}"`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`Skipped ${file} (doesn't exist locally, nothing to migrate)`);
    } else {
      throw err;
    }
  }
}

console.log('Done.');
