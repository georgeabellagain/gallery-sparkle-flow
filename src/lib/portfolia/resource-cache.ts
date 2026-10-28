/** Renderer-owned LRU. Protect resources still attached to the live scene during async replacement. */
export function createResourceCache<K, V>(limit: number, release: (value: V) => void) {
  const entries = new Map<K, V>();
  return {
    get(key: K) {
      const value = entries.get(key);
      if (value !== undefined) { entries.delete(key); entries.set(key, value); }
      return value;
    },
    set(key: K, value: V) {
      const previous = entries.get(key);
      if (previous !== undefined && previous !== value) release(previous);
      entries.delete(key); entries.set(key, value);
    },
    trim(protectedKeys: readonly K[] = []) {
      for (const [key, value] of entries) {
        if (entries.size <= limit) break;
        if (protectedKeys.includes(key)) continue;
        entries.delete(key); release(value);
      }
    },
    clear() { entries.forEach(release); entries.clear(); },
    get size() { return entries.size; },
  };
}
