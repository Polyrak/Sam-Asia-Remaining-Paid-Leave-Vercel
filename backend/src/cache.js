const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlSeconds) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheClear() {
  store.clear();
}

export async function withCache(key, ttlSeconds, loader) {
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const value = await loader();
  cacheSet(key, value, ttlSeconds);
  return value;
}
