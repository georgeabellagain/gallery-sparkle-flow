import type { Profile } from "./store";

/** Public example selected by the site owner; PDF/settings load from published code adu2v. */
export const SAMPLE = {
  code: "sample",
  profile: {
    name: "Scarlett Bushell",
    title: "Fashion lookbook",
    intro: "Property of Scarlett Bushell 2026",
    email: "",
    links: [],
  } satisfies Profile,
};

/** Clearly labelled, deterministic sample analytics for the example portfolio. */
export function sampleAnalytics() {
  const now = Date.now();
  const visits: { t: number; v: string }[] = [];
  const downloads: number[] = [];
  for (let d = 0; d < 90; d++) {
    const n = Math.round(3 + 3 * Math.sin(d / 5) + (d % 7 === 2 ? 6 : 0));
    for (let i = 0; i < n; i++) visits.push({ t: now - d * 864e5 - i * 3600e3, v: `s${(d * 7 + i) % 140}` });
    if (d % 3 === 0) downloads.push(now - d * 864e5);
  }
  return { visits, downloads };
}

