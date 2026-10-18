/** Google Ads conversion tracking with regional cookie consent (UK, EEA, Switzerland, Canada). */
declare global {
  interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void }
}

export const GOOGLE_ADS_ID = "AW-18520484540";
export const SIGNUP_SEND_TO = "AW-18520484540/hH_WCK7wnaEdELzVoP9E";
export const SUBSCRIPTION_SEND_TO = "AW-18520484540/CWYgCKnxnaEdELzVoP9E";

export const STORAGE_KEY = "cookie_consent";
/** Record of what the visitor saw and chose; the flag above gates sending. */
export const RECORD_KEY = "cookie_consent_record";
export const NOTICE_VERSION = "2026-10-18";
export const CONSENT_EVENT = "pf-cookie-settings";

const CONSENT_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH','CA'];
let consentRegion: Promise<boolean> | undefined;

export function isConsentRequiredRegion(): Promise<boolean> {
  return consentRegion ??= lookupConsentRegion();
}

async function lookupConsentRegion(): Promise<boolean> {
  try {
    const res = await fetch("/cdn-cgi/trace", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return true;
    const country = (await res.text()).match(/^loc=([A-Z0-9]{2})$/m)?.[1];
    if (!country || country === "XX" || country === "T1") return true;
    return CONSENT_COUNTRIES.includes(country);
  } catch {
    return true;
  }
}

export function storedChoice(): "granted" | "denied" | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "granted" || v === "denied" ? v : null;
}

export async function hasAdConsent(): Promise<boolean> {
  return storedChoice() === "granted";
}

export async function canTrackAds(): Promise<boolean> {
  const choice = storedChoice();
  if (choice !== null) return choice === "granted";
  const required = await isConsentRequiredRegion();
  const latest = storedChoice();
  return latest !== null ? latest === "granted" : !required;
}

export function updateConsent(decision: "granted" | "denied") {
  if (decision === "denied") window.gtag?.("set", "user_data", null);
  window.gtag?.("consent", "update", {
    ad_storage: decision,
    ad_user_data: decision,
    ad_personalization: decision,
  });
}

export function saveChoice(decision: "granted" | "denied") {
  const previous = localStorage.getItem(RECORD_KEY);
  const history = previous ? (JSON.parse(previous) as { history?: unknown[] }).history ?? [] : [];
  const entry = { decision, at: new Date().toISOString(), notice: NOTICE_VERSION, purposes: ["Google Ads conversion measurement"], recipient: "Google" };
  localStorage.setItem(RECORD_KEY, JSON.stringify({ ...entry, history: [...history, entry].slice(-10) }));
  localStorage.setItem(STORAGE_KEY, decision);
  updateConsent(decision);
  if (decision === "granted") void loadGoogleAds();
}

export async function loadGoogleAds() {
  const allowed = await canTrackAds();
  if (!allowed) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  updateConsent("granted");
  if (document.querySelector("script[data-google-ads]")) return;
  window.gtag("set", "developer_id.dZjgwMW", true);
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  script.async = true;
  script.setAttribute("data-google-ads", "");
  document.head.appendChild(script);
}

/** Sends a conversion only when this visitor may be tracked; blocked events are never queued. */
export async function reportConversion(sendTo: string, extra: Record<string, unknown> = {}) {
  await loadGoogleAds();
  if (!(await canTrackAds())) return;
  window.gtag?.("event", "conversion", { send_to: sendTo, ...extra });
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
