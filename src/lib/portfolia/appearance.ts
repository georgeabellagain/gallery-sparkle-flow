import type { ViewerSettings } from "./store";
export function looksForMode(view: ViewerSettings, mode: ViewerSettings["mode"]): ("clean" | "studio")[] {
  const looks = view.looks?.length ? view.looks : [view.look];
  const offered = looks.filter(look => look !== "studio" || !view.studioModes || view.studioModes.includes(mode));
  return offered.length ? offered : ["clean"];
}
export function openingLook(view: ViewerSettings, mode: ViewerSettings["mode"]) {
  const looks = looksForMode(view, mode);
  return looks.includes(view.look) ? view.look : looks[0]!;
}
