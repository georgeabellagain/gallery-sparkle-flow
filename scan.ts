import { useEffect, useState } from "react";

/** The address a QR code carries: the portfolio's own address, marked so that a phone which scans it opens full screen. */
export function scanUrl(url: string): string {
  const hashAt = url.indexOf("#");
  const base = hashAt < 0 ? url : url.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : url.slice(hashAt);
  if (/[?&]qr=1(&|$)/.test(base)) return url;
  return `${base}${base.includes("?") ? "&" : "?"}qr=1${hash}`;
}

/** True when this page was opened from a QR code (see scanUrl). */
export function openedFromQr(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("qr") === "1";
}

/** Read after the page has loaded in the browser, so the server's page and the browser's agree at first. */
export function useOpenedFromQr(): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => setValue(openedFromQr()), []);
  return value;
}

/** A phone or tablet (a touch screen, or a narrow window). */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
}
