/** "Someone opened your portfolio" emails: the limits and the small pure decisions, shared with tests. */

/** At most one email per portfolio in this many hours; opens in between join the next email. */
export const OPEN_EMAIL_GAP_HOURS = 6;
/** And at most this many a day. */
export const OPEN_EMAIL_DAILY = 5;
/** A visit counts only if its event was recorded this recently. */
export const OPEN_EVENT_WINDOW_MS = 5 * 60_000;

const BOT = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|embedly|whatsapp|telegram|slack|discord|curl|wget|python|java\/|okhttp|go-http/i;

/** Link previews, crawlers and scripts never send an email; a missing user agent is treated as one. */
export const isBotAgent = (ua: string | null | undefined) => !ua || BOT.test(ua);

export function deviceOf(ua: string): "phone" | "tablet" | "computer" {
  if (/ipad|tablet|kindle|silk|playbook/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/i.test(ua)) return "phone";
  return "computer";
}

const WITH_THE = /^(United |Netherlands$|Philippines$|Bahamas$|Maldives$|Gambia$|Comoros$|Seychelles$|Czech Republic$|Dominican Republic$|Central African Republic$|Vatican City$)|Islands$/;

/** Cloudflare's two-letter country, as words for "in …" ("GB" → "the United Kingdom"). Unknown, Tor and missing codes give nothing. */
export function countryName(code: string | null | undefined): string | undefined {
  if (!code || !/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return undefined;
  try {
    const name = new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code);
    if (!name || name === code) return undefined;
    return WITH_THE.test(name) ? `the ${name}` : name;
  } catch {
    return undefined;
  }
}

/** "on 22 October 2026 at 14:05 UTC": the owner's own time zone isn't known, so the email says UTC plainly. */
export function openedWhen(at: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(at);
  return `on ${day} at ${time} UTC`;
}
