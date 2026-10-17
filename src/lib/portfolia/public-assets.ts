import { freeViewer } from "./premium-appearance";
import { backgroundKeys } from "./background-settings";
import { foldoutKeys } from "./foldouts";
import type { Portfolio } from "./store";

/** This flag must come from server-verified billing, never portfolio JSON. */
export function publicAssetKeys(p: Portfolio, personal: boolean): string[] {
  const paidKeys = [p.profile?.cv?.blobKey, p.style?.bannerKey];
  const keys = [p.pdf?.blobKey, p.profile?.photoKey, ...(personal ? paidKeys : []), ...backgroundKeys(personal ? p.viewer : freeViewer(p.viewer)), ...foldoutKeys(p.pdf)];
  return [...new Set(keys.filter((key): key is string => typeof key === "string" && /^[a-zA-Z0-9_.-]+$/.test(key) && (personal || !paidKeys.includes(key))))];
}
export function publicPortfolioPlan(p: Portfolio, personal: boolean): Portfolio {
  return { ...p, ...(!personal ? { viewer: freeViewer(p.viewer) } : {}), plan: personal ? "personal" : "free", cancelledAt: undefined, profile: { ...p.profile, ...(!personal ? { cv: undefined } : {}) }, ...(!personal && p.style ? { style: { ...p.style, bannerKey: undefined } } : {}) };
}
