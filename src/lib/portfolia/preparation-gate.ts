/** Pause speculative main-thread work, while demanded pages can always finish. */
export function createPreparationGate<Key>() {
  let paused = false, closed = false;
  const urgent = new Map<Key, number>();
  const waiting: Array<{ key: Key; run: () => void }> = [];
  const flush = () => {
    for (const item of waiting.splice(0)) {
      if (closed || !paused || urgent.has(item.key)) item.run();
      else waiting.push(item);
    }
  };
  return {
    setPaused(value: boolean) { paused = value; flush(); },
    schedule(key: Key, run: () => void) { if (closed || !paused || urgent.has(key)) run(); else waiting.push({ key, run }); },
    prioritize(key: Key) {
      urgent.set(key, (urgent.get(key) ?? 0) + 1); flush();
      return () => { const n = (urgent.get(key) ?? 1) - 1; if (n) urgent.set(key, n); else urgent.delete(key); };
    },
    close() { closed = true; urgent.clear(); flush(); },
  };
}
