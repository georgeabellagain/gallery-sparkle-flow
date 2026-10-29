import { MAX_LEAD_RECIPIENTS } from "./store";

/** A Google Analytics 4 measurement ID ("G-" then letters and digits), tidied, or undefined. */
export function readableGa4Id(value: unknown): string | undefined {
  const id = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^G-[A-Z0-9]{4,16}$/.test(id) ? id : undefined;
}

/** Team addresses that also get lead alerts: real-looking emails, no repeats, at most MAX_LEAD_RECIPIENTS. */
export function readableLeadRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) {
    const email = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) seen.add(email);
    if (seen.size >= MAX_LEAD_RECIPIENTS) break;
  }
  return [...seen];
}

const CONSENT_KEY = (id: string) => `pf-ga-consent:${id}`;
/** What this reader chose about the owner's Google Analytics (remembered per measurement ID), or null if not asked. */
export function ga4Choice(id: string): "yes" | "no" | null {
  try { const v = localStorage.getItem(CONSENT_KEY(id)); return v === "yes" || v === "no" ? v : null; } catch { return null; }
}
export function rememberGa4Choice(id: string, choice: "yes" | "no") {
  try { localStorage.setItem(CONSENT_KEY(id), choice); } catch { /* asked again next time */ }
}

/**
 * Starts the owner's Google Analytics 4 for this page (only after the reader agreed). Page views are sent as the
 * reader turns pages, so the owner's own reports show which pages are read.
 */
export function startGa4(id: string): { page: (n: number) => void } {
  type Gtag = (...args: unknown[]) => void;
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag };
  if (!document.querySelector(`script[data-pf-ga="${id}"]`)) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    s.dataset["pfGa"] = id;
    document.head.appendChild(s);
    w.dataLayer = w.dataLayer || [];
    // gtag reads the arguments object itself, so it can't be a rest parameter.
    // eslint-disable-next-line prefer-rest-params
    w.gtag = function gtag() { (w.dataLayer as unknown[]).push(arguments); } as Gtag;
    w.gtag("js", new Date());
    w.gtag("config", id, { anonymize_ip: true });
  }
  return { page: (n: number) => w.gtag?.("event", "page_view", { page_title: `${document.title} · page ${n}`, page_location: `${location.href.split("#")[0]}#page=${n}` }) };
}
