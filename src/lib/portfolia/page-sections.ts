import type { ExtraKind } from "./scrapbook-transform";

/**
 * The things added on top of pages, as separate editor tools (they were once all under one "Scrapbook"), so each
 * is easy to find: notes, buttons and pop-ups, pictures and video, animations, ways round the book, spotlights.
 */
export type PageSection = "notes" | "buttons" | "media" | "motion" | "navigation" | "spotlights";
export const PAGE_SECTIONS: readonly PageSection[] = ["notes", "buttons", "media", "motion", "navigation", "spotlights"];
/** The tool each kind of page item is edited in, so picking an item on the page opens the right one. */
export const SECTION_OF: Record<ExtraKind, PageSection> = {
  foldouts: "notes", hotspots: "buttons", slideshows: "media", videos: "media", stickers: "motion",
  tags: "navigation", links: "navigation", jumps: "navigation", spotlights: "spotlights",
};
