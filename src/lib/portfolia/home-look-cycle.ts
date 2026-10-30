/** Visible-time dwell: Simple gets 20 seconds, later looks get 10. */
export const HOME_FIRST_LOOK_MS = 20_000;
export const HOME_LOOK_INTERVAL_MS = 10_000;
export type HomeDemoLook = "simple" | "studio";
type Schedule = (run: () => void, delay: number) => () => void;
const scheduleTimeout: Schedule = (run, delay) => {
  const timer = setTimeout(run, delay);
  return () => clearTimeout(timer);
};
export function createHomeLookCycle(show: (look: HomeDemoLook) => void, schedule: Schedule = scheduleTimeout, now = () => performance.now()) {
  let ready = false, presented = false, active = false, firstComplete = false, presentedStudio = false;
  let look: HomeDemoLook = "simple", remaining = HOME_FIRST_LOOK_MS, started = 0;
  let cancel: (() => void) | undefined;
  const clear = (preserve = true) => {
    if (cancel && preserve) remaining = Math.max(0, remaining - (now() - started));
    cancel?.(); cancel = undefined;
  };
  const select = (next: HomeDemoLook) => { look = next; show(next); };
  const advance = () => {
    if (!active || !presented || cancel) return;
    if (firstComplete && !presentedStudio) {
      if (!ready) return;
      presentedStudio = true; select("studio"); remaining = HOME_LOOK_INTERVAL_MS;
    }
    if (presentedStudio && !ready) return;
    started = now();
    cancel = schedule(() => {
      cancel = undefined;
      if (!active || !presented) return;
      if (!firstComplete) firstComplete = true;
      else if (ready) select(look === "studio" ? "simple" : "studio");
      remaining = HOME_LOOK_INTERVAL_MS;
      advance();
    }, remaining);
  };
  return {
    setPresented(value: boolean) {
      if (presented === value) return;
      presented = value;
      if (!value) { clear(false); firstComplete = presentedStudio = false; remaining = HOME_FIRST_LOOK_MS; if (look !== "simple") select("simple"); }
      else advance();
    },
    setReady(value: boolean) {
      if (ready === value) return;
      ready = value;
      if (!ready && presentedStudio) { clear(false); presentedStudio = false; remaining = HOME_LOOK_INTERVAL_MS; if (look !== "simple") select("simple"); }
      if (ready) advance();
    },
    setActive(value: boolean) {
      if (active === value) return;
      active = value;
      if (active) advance(); else clear();
    },
    pause() { active = false; clear(); },
  };
}
