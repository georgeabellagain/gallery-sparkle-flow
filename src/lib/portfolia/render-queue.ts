/** Serialise work on a shared GPU context; failures must not block later pages. */
export function createRenderQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;
  return {
    enqueue<T>(work: () => Promise<T>): Promise<T> {
      const run = () => {
        if (closed) throw new Error("Reader closed");
        return work();
      };
      const result = tail.then(run, run);
      tail = result.catch(() => undefined);
      return result;
    },
    close() { closed = true; },
  };
}
