/**
 * Sharing a portfolio to social networks. Each network's public share page only accepts a link (and, for some,
 * text), so a link share shows the portfolio's preview card. Networks never accept a video through a web link: a
 * video share goes through the device's own share sheet where it can carry files, otherwise the video downloads,
 * the caption is copied, and the network's composer opens for the creator to attach it.
 */
export type SocialNetwork = "linkedin" | "facebook" | "x" | "whatsapp" | "pinterest" | "email";
export const SOCIAL_NETWORKS: { id: SocialNetwork; label: string }[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "pinterest", label: "Pinterest" },
  { id: "email", label: "Email" },
];
export function shareCaption(name: string | undefined, url: string) {
  const who = name?.trim();
  return `${who ? `${who}'s portfolio` : "My portfolio"}: flip through it here ${url}`;
}
/** The network's share page for a link; `image` is the preview picture Pinterest needs. */
export function shareLink(network: SocialNetwork, url: string, text: string, image?: string) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  switch (network) {
    case "linkedin": return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x": return `https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(text.replace(url, "").trim())}`;
    case "whatsapp": return `https://wa.me/?text=${t}`;
    case "pinterest": return `https://www.pinterest.com/pin/create/button/?url=${u}&description=${t}${image ? `&media=${encodeURIComponent(image)}` : ""}`;
    case "email": return `mailto:?subject=${encodeURIComponent("Have a look at my portfolio")}&body=${t}`;
  }
}
/** Where to post a downloaded video: the network's own composer (LinkedIn can start one with the caption). */
export function videoComposer(network: SocialNetwork, text: string) {
  switch (network) {
    case "linkedin": return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    case "facebook": return "https://www.facebook.com/";
    case "x": return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    case "whatsapp": return `https://wa.me/?text=${encodeURIComponent(text)}`;
    case "pinterest": return "https://www.pinterest.com/pin-creation-tool/";
    case "email": return `mailto:?subject=${encodeURIComponent("Have a look at my portfolio")}&body=${encodeURIComponent(text)}`;
  }
}
/** True when this browser can hand a video file to installed apps through the system share sheet. */
export function canShareVideo(file: File, nav: Pick<Navigator, "canShare"> | undefined = typeof navigator !== "undefined" ? navigator : undefined) {
  try { return Boolean(nav?.canShare?.({ files: [file] })); } catch { return false; }
}
