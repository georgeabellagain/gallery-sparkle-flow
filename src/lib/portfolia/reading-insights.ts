import type { ReadingRow } from "./reading.functions";

export type Count = { name: string; count: number };
export type PageStat = { page: number; views: number; readers: number; seconds: number; averageSeconds: number };
export type ReadingSummary = {
  readers: number;
  pageViews: number;
  /** Average reading time per reader, in seconds. */
  averageSeconds: number;
  /** Share of readers (0..1) who reached the last page. */
  finished: number;
  pages: PageStat[];
  clicks: Count[];
  plays: Count[];
  devices: Count[];
  countries: Count[];
  sources: Count[];
};

const top = (map: Map<string, number>, limit: number): Count[] =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));
const bump = (map: Map<string, number>, key: string | null | undefined, by = 1) => { if (key) map.set(key, (map.get(key) ?? 0) + by); };

/**
 * Turns raw reader events into what an owner wants to know: how many people read, how far and for how long, which
 * pages hold attention, what they pressed and played, and their devices, countries and where they came from.
 * Device, country and source are counted once per reader, not once per event.
 */
export function summariseReading(rows: ReadingRow[], totalPages: number): ReadingSummary {
  const readers = new Set<string>(), finishers = new Set<string>(), perReader = new Map<string, { device?: string; country?: string; source?: string }>();
  const views = new Map<number, number>(), viewers = new Map<number, Set<string>>(), time = new Map<number, number>();
  const clicks = new Map<string, number>(), plays = new Map<string, number>();
  let pageViews = 0, seconds = 0, anonymous = 0;
  for (const r of rows) {
    const who = r.visitor ?? `anon-${anonymous++}`;
    readers.add(who);
    const me = perReader.get(who) ?? {};
    me.device ??= r.device ?? undefined; me.country ??= r.country ?? undefined; me.source ??= r.source ?? undefined;
    perReader.set(who, me);
    if (r.kind === "page" && r.page) {
      pageViews++;
      views.set(r.page, (views.get(r.page) ?? 0) + 1);
      (viewers.get(r.page) ?? viewers.set(r.page, new Set()).get(r.page)!).add(who);
      if (totalPages > 0 && r.page >= totalPages - 1) finishers.add(who);
    } else if (r.kind === "time" && r.page && r.seconds) {
      seconds += r.seconds;
      time.set(r.page, (time.get(r.page) ?? 0) + r.seconds);
    } else if (r.kind === "click") bump(clicks, r.target);
    else if (r.kind === "play") bump(plays, r.target);
  }
  const devices = new Map<string, number>(), countries = new Map<string, number>(), sources = new Map<string, number>();
  for (const me of perReader.values()) { bump(devices, me.device); bump(countries, me.country); bump(sources, me.source ?? "Direct or unknown"); }
  const pages = [...new Set([...views.keys(), ...time.keys()])].sort((a, b) => a - b).map((page) => {
    const v = views.get(page) ?? 0, t = time.get(page) ?? 0;
    return { page, views: v, readers: viewers.get(page)?.size ?? 0, seconds: t, averageSeconds: v ? Math.round(t / v) : 0 };
  });
  return {
    readers: readers.size,
    pageViews,
    averageSeconds: readers.size ? Math.round(seconds / readers.size) : 0,
    finished: readers.size ? finishers.size / readers.size : 0,
    pages,
    clicks: top(clicks, 10),
    plays: top(plays, 10),
    devices: top(devices, 3),
    countries: top(countries, 8),
    sources: top(sources, 8),
  };
}

/** Every event as a spreadsheet (CSV), for reports in any tool. */
export function readingCsv(rows: ReadingRow[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Neutralise spreadsheet formulas (CSV injection) in text values.
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["time", "event", "page", "target", "seconds", "device", "country", "source", "reader"];
  return [head.join(","), ...rows.map((r) => [r.created_at, r.kind, r.page, r.target, r.seconds, r.device, r.country, r.source, r.visitor].map(cell).join(","))].join("\n");
}

/** "1m 05s", "42s". */
export const duration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`);
