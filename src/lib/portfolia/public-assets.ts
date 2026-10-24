import { freeViewer } from "./premium-appearance";
import { backgroundKeys } from "./background-settings";
import { foldoutKeys, pageVideoKeys } from "./foldouts";
import { currentPageImageKeys, safeAssetKey } from "./page-images";
import type { Portfolio } from "./store";
import { SPOTLIGHT_LIMITS } from "./page-extras";

/** This flag must come from server-verified billing, never portfolio JSON. */
export function publicAssetKeys(p: Portfolio, personal: boolean): string[] {
  // Page videos are a Personal feature: an unpaid owner's videos (and their stills) are never signed.
  const paidKeys = [p.profile?.cv?.blobKey, p.style?.bannerKey, ...pageVideoKeys(p.pdf)];
  // Page pictures are drawn from the published PDF itself, so they go wherever the PDF goes, on every plan.
  const keys = [p.pdf?.blobKey, p.profile?.photoKey, ...(personal ? paidKeys : []), ...backgroundKeys(personal ? p.viewer : freeViewer(p.viewer)), ...foldoutKeys(p.pdf), ...currentPageImageKeys(p.pdf)];
  return [...new Set(keys.filter((key): key is string => typeof key === "string" && safeAssetKey(key) && (personal || !paidKeys.includes(key))))];
}
export function publicPortfolioPlan(p: Portfolio, personal: boolean): Portfolio {
  // Free keeps its first few spotlights; videos are Personal only.
  const freePdf = !personal && p.pdf ? { pdf: { ...p.pdf, videos: undefined, spotlights: p.pdf.spotlights?.slice(0, SPOTLIGHT_LIMITS.free) } } : {};
  // A lead form only takes replies for Personal owners, so readers of an unpaid portfolio never see one.
  return { ...p, notifyOnOpen: undefined, ...(!personal ? { leadForm: undefined } : {}), ...(!personal ? { viewer: freeViewer(p.viewer) } : {}), ...freePdf, plan: personal ? "personal" : "free", cancelledAt: undefined, profile: { ...p.profile, ...(!personal ? { cv: undefined } : {}) }, ...(!personal && p.style ? { style: { ...p.style, bannerKey: undefined } } : {}) };
}
