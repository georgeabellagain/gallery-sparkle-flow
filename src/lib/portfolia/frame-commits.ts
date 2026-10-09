/** Stage loaded artwork until its lighting frame can present it atomically. */
export function createFrameCommits<Key, Job extends { current: () => boolean }>() {
  const jobs = new Map<Key, Job>();
  return {
    stage(key: Key, job: Job) { jobs.set(key, job); },
    remove(key: Key) { jobs.delete(key); },
    clear() { jobs.clear(); },
    flush(visit: (key: Key, job: Job) => void) {
      for (const [key, job] of [...jobs]) {
        if (jobs.get(key) !== job) continue;
        jobs.delete(key);
        if (job.current()) visit(key, job);
      }
    },
  };
}
