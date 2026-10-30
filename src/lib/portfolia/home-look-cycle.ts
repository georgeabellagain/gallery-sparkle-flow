/** Readiness-gated homepage showcase. Pausing never schedules catch-up switches. */
export const HOME_LOOK_INTERVAL_MS = 10_000;
export type HomeDemoLook = "simple" | "studio";
type Schedule = (run: () => void, delay: number) => () => void;
const scheduleTimeout: Schedule = (run, delay) => {
  const timer = setTimeout(run, delay);
  return () => clearTimeout(timer);
};

export function createHomeLookCycle(show: (look: HomeDemoLook) => void, schedule: Schedule = scheduleTimeout) {
  let ready = false, active = false, presentedStudio = false;
  let look: HomeDemoLook = "simple";
  let cancel: (() => void) | undefined;
  const clear = () => { cancel?.(); cancel = undefined; };
  const select = (next: HomeDemoLook) => { look = next; show(next); };
  const advance = () => {
    clear();
    if (!ready || !active) return;
    if (!presentedStudio) { presentedStudio = true; select("studio"); }
    cancel = schedule(() => {
      cancel = undefined;
      if (!ready || !active) return;
      select(look === "studio" ? "simple" : "studio");
      advance();
    }, HOME_LOOK_INTERVAL_MS);
  };
  return {
    setReady(value: boolean) {
      if (ready === value) return;
      ready = value;
      if (!ready) { clear(); presentedStudio = false; if (look !== "simple") select("simple"); }
      else advance();
    },
    setActive(value: boolean) {
      if (active === value) return;
      active = value;
      if (active) advance(); else clear();
    },
    pause() { active = false; clear(); },
  };
}
