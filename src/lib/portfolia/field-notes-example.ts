import type { PublicPortfolio } from "./public.functions";
import type { Portfolio, ViewerSettings } from "./store";

/**
 * "Field Notes", Portfolia's own example book, shipped with the site (public/examples/field-notes) rather than
 * published from an account. Each page explains a feature, and the tabs, notes, spotlights, links and video on
 * it are the real ones, so the homepage reader shows them working.
 */
export const FIELD_NOTES_CODE = "field-notes";
const BASE = "/examples/field-notes";
const KEYS = { pdf: "fieldnotes_book.pdf", video: "fieldnotes_turntable.mp4", poster: "fieldnotes_turntable_poster.jpg" };

/** The lighting and backdrop of the previous homepage example, with the magazine-like Soft fold turn. */
const viewer: ViewerSettings = {
  mode: "book", look: "studio", looks: ["studio", "clean"], modes: ["book", "paged"], bookStyle: "flipbook",
  background: "midnight", backgroundColor: "#ffffff", backgroundPreset: "painted_plaster_wall", backgroundLighting: true, background3D: false,
  backgroundFit: { scale: 0.85, tile: true, x: 0, y: 0 },
  finish: "satin", paper: "smooth", paperTextureStrength: 0, light: "soft", shadow: "subtle", simpleShadow: true, simpleShadowOpacity: 0.19,
  thickness: "thin", spreads: "single", showHeader: false, ribbon: true, ribbonPage: 6,
  studioBrightness: 0.53, studioImperfections: 0, studioLighting: "10", studioLightingStrength: 0.71, studioPlayback: "live", studioTopLight: 0,
  turnCurve: "soft", turnSpeed: 1.45,
} as ViewerSettings;

const portfolio: Portfolio = {
  code: FIELD_NOTES_CODE,
  name: "Field Notes",
  status: "published",
  plan: "personal",
  allowDownload: false,
  createdAt: Date.UTC(2026, 9, 22),
  profile: { name: "Portfolia", title: "Example flipbook", intro: "Field Notes, an example book made by Portfolia.", email: "", links: [] },
  viewer,
  pdf: {
    blobKey: KEYS.pdf,
    name: "Field Notes — a Portfolia example.pdf",
    bytes: 141706,
    pages: 16,
    uploadedAt: Date.UTC(2026, 9, 22),
    tags: [
      { id: "tab_letter", page: 3, label: "Letter", colour: "#e8604c" },
      { id: "tab_book", page: 4, label: "The book", colour: "#f2a93b" },
      { id: "tab_spot", page: 6, label: "Spotlights", colour: "#4fa3d1" },
      { id: "tab_case", page: 8, label: "Case study", colour: "#6bbf8a" },
      { id: "tab_share", page: 13, label: "Sharing", colour: "#8c79d8" },
    ],
    spotlights: [
      { id: "spot_notes", page: 6, half: "left", x: 0.47, y: 0.255, width: 0.41, height: 0.26, caption: "Every dimension the joiner needed, at 1:20: treads, risers, handrail and balusters." },
      { id: "spot_tread", page: 6, half: "left", x: 0.14, y: 0.4, width: 0.26, height: 0.15, caption: "Oak treads with a 12 mm nosing: the detail the family touch every day." },
      { id: "spot_court", page: 8, half: "left", x: 0.62, y: 0.41, width: 0.26, height: 0.22, caption: "The courtyard: south-facing, out of the wind, and the room the family use most." },
    ],
    foldouts: [
      {
        id: "note_palette", page: 7, half: "right", style: "sticky", title: "Sticky note", colour: "#f6e27a", hinge: "top", openable: false,
        x: 0.64, y: 0.34, width: 0.26, height: 0.2, rotation: -6,
        outside: { colour: "#f6e27a", text: "Round three. The client asked for “calm, not cute”.", font: "hand", align: "center", valign: "middle" },
        inside: { colour: "#fbf6e9", text: "" },
      },
      {
        id: "note_process", page: 9, half: "right", style: "foldout", title: "Text note", colour: "#e5dcc6", hinge: "left",
        x: 0.58, y: 0.03, width: 0.32, height: 0.34,
        outside: { colour: "#efe5d3", text: "Process\n(open me)", font: "serif", align: "center", valign: "middle" },
        inside: { colour: "#fbf6e9", text: "Twenty-two card models, three site visits in the rain, and one sketch on the back of a planning letter that became the courtyard.", font: "serif" },
      },
    ],
    links: [
      { id: "link_site", page: 11, half: "right", url: "https://portfolia.site/", size: 0.11, x: 0.1598, y: 0.3857 },
      { id: "link_insta", page: 11, half: "right", url: "https://www.instagram.com/", size: 0.11, x: 0.4413, y: 0.3857 },
      { id: "link_behance", page: 11, half: "right", url: "https://www.behance.net/", size: 0.11, x: 0.7228, y: 0.3857 },
    ],
    // The turntable clip fills the picture frame on page 10; it has no sound.
    videos: [{
      id: "vid_turntable", page: 10, half: "left", x: 48 / 540, y: 0.29888, width: 444 / 540, height: 0.25694, aspect: 2.4,
      blobKey: KEYS.video, posterKey: KEYS.poster, mime: "video/mp4", bytes: 1512564, name: "turntable.mp4", silent: true,
    }],
  },
};

/** The example in the shape the public reader receives, with links to the files shipped beside the site. */
export const fieldNotesExample = (): NonNullable<PublicPortfolio> => ({
  portfolio,
  urls: { [KEYS.pdf]: `${BASE}/field-notes.pdf`, [KEYS.video]: `${BASE}/turntable.mp4`, [KEYS.poster]: `${BASE}/turntable-poster.jpg` },
});
