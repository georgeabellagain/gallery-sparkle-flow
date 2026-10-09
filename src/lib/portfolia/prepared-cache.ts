/** Deduplicate preparation and keep completed results within a byte budget. */
export function createPreparedCache<K, V>(budget: number, bytesOf: (value: V) => number) {
  const values = new Map<K, { value: V; bytes: number }>();
  const pending = new Map<K, Promise<V>>();
  let bytes = 0;
  const get = (key: K) => {
    const hit = values.get(key);
    if (!hit) return undefined;
    values.delete(key); values.set(key, hit);
    return hit.value;
  };
  return {
    get,
    load(key: K, prepare: () => Promise<V>): Promise<V> {
      const hit = get(key);
      if (hit !== undefined) return Promise.resolve(hit);
      const running = pending.get(key);
      if (running) return running;
      const result = Promise.resolve().then(prepare).then(value => {
        const cost = bytesOf(value);
        if (cost <= budget) {
          values.set(key, { value, bytes: cost }); bytes += cost;
          while (bytes > budget && values.size) {
            const oldest = values.keys().next().value!;
            bytes -= values.get(oldest)!.bytes; values.delete(oldest);
          }
        }
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, result);
      return result;
    },
    stats: () => ({ bytes, entries: values.size, pending: pending.size }),
  };
}
