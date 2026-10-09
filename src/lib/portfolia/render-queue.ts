/** Bounded preparation; default to serial work for a shared GPU context. */
export function createRenderQueue(concurrency = 1) {
  const limit = Number.isFinite(concurrency) ? Math.max(1, Math.min(4, Math.floor(concurrency))) : 1;
  const waiting: (() => void)[] = [];
  let running = 0;
  let closed = false;
  const pump = () => {
    while (running < limit && waiting.length) {
      running++;
      waiting.shift()!();
    }
  };
  return {
    enqueue<T>(work: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        waiting.push(() => {
          Promise.resolve().then(() => {
            if (closed) throw new Error("Reader closed");
            return work();
          }).then(resolve, reject).finally(() => { running--; pump(); });
        });
        pump();
      });
    },
    close() { closed = true; },
  };
}
