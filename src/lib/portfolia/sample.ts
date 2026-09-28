import type { Profile } from "./store";

/** Demonstration content — not a real person or real usage. */
export const SAMPLE = {
  code: "sample",
  pdfUrl: "/sample/marta-oyelaran-portfolio.pdf",
  profile: {
    name: "Marta Oyelaran",
    title: "Architect, ARB",
    intro:
      "Small public buildings, reading rooms and landscape structures. Currently working between Bristol and Lagos. (Example portfolio — demonstration content.)",
    email: "studio@example.com",
    links: [{ label: "Instagram", url: "https://example.com/marta" }],
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
