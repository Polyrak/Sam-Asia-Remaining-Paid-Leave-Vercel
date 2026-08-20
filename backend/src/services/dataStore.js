import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

// Vercel's filesystem is read-only/ephemeral outside a request, so the JSON
// files under src/data only work for local dev. On Vercel (KV env vars
// present), the same get/set calls go to Vercel KV instead — every other
// module in the app is unaware of the difference.
const useKv = Boolean(process.env.KV_REST_API_URL);

let kvClient = null;
async function getKv() {
  if (!kvClient) {
    const { kv } = await import('@vercel/kv');
    kvClient = kv;
  }
  return kvClient;
}

export async function readStore(name, defaultValue) {
  if (useKv) {
    const kv = await getKv();
    const value = await kv.get(name);
    return value ?? defaultValue;
  }
  try {
    const raw = await readFile(path.join(dataDir, `${name}.json`), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return defaultValue;
    throw err;
  }
}

export async function writeStore(name, value) {
  if (useKv) {
    const kv = await getKv();
    await kv.set(name, value);
    return;
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, `${name}.json`), JSON.stringify(value, null, 2));
}
