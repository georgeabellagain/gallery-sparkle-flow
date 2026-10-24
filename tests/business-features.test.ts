import { test } from "node:test";
import assert from "node:assert/strict";
import { HOTSPOT_SIZE, MAX_SLIDES, SLIDESHOW_SIZE, STICKERS, placeSlideshow, readablePageSlideshows, slideshowsForLeaf, slideshowsForPage, validatePageSlideshow, type PageSlideshow, hotspotHref, hotspotsForPage, placeHotspot, readablePageHotspots, validatePageHotspot, videoEmbedUrl, type PageHotspot } from "../src/lib/portfolia/page-extras";
import { defaultLeadForm, leadProblem, leadsCsv, readableLeadForm } from "../src/lib/portfolia/lead-form";
import { foldoutKeys } from "../src/lib/portfolia/foldouts";
import { freeViewer } from "../src/lib/portfolia/premium-appearance";
import { backgroundKeys } from "../src/lib/portfolia/background-settings";

const tag: PageHotspot = { id: "h1", page: 2, half: "right", style: "tag", x: 0.3, y: 0.4, size: HOTSPOT_SIZE.tag, colour: "#e8604c", action: "popup", label: "Linen shirt", title: "Linen shirt", price: "£45", imageKey: "hotspot_abc" };

test("hotspots: links are made safe and videos become privacy-friendly players", () => {
  assert.equal(hotspotHref("shop.com/item"), "https://shop.com/item");
  assert.equal(hotspotHref("hello@studio.com"), "mailto:hello@studio.com");
  assert.equal(hotspotHref("tel:+44 20 7946 0000"), "tel:+442079460000");
  assert.equal(hotspotHref("javascript:alert(1)"), null);
  assert.equal(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(videoEmbedUrl("https://vimeo.com/123456789"), "https://player.vimeo.com/video/123456789?dnt=1");
  assert.equal(videoEmbedUrl("https://example.com/video"), null);
});

test("hotspots are validated, kept on the page and their pictures publish with the portfolio", () => {
  assert.equal(validatePageHotspot(tag, 4), null);
  assert.ok(validatePageHotspot({ ...tag, action: "link" }, 4), "a link needs somewhere to go");
  assert.equal(validatePageHotspot({ ...tag, action: "link", url: "https://shop.com/" }, 4), null);
  assert.ok(validatePageHotspot({ ...tag, url: "shop.com" }, 4), "only saved once made safe");
  assert.ok(validatePageHotspot({ ...tag, video: "https://example.com" }, 4));
  assert.ok(validatePageHotspot({ ...tag, title: "x".repeat(200) }, 4));
  const moved = placeHotspot(tag, 2, 2, tag.size);
  assert.ok(moved.x + moved.size <= 1 && moved.y < 1);
  assert.equal(readablePageHotspots([tag, { ...tag }], 4).length, 1);
  assert.equal(hotspotsForPage([tag], 2, true)[0]!.x, 0.5 + tag.x / 2);
  assert.ok(foldoutKeys({ hotspots: [tag], pages: 4 }).includes("hotspot_abc"));
});

test("lead forms: email is always required, chosen fields are checked, and the CSV is spreadsheet-safe", () => {
  const form = { ...defaultLeadForm(10), fields: { name: "required" as const, phone: "optional" as const } };
  assert.ok(readableLeadForm(form, 10));
  assert.equal(readableLeadForm({ ...form, page: 99 }, 10), null);
  assert.equal(readableLeadForm({ ...form, fields: { shoe: "required" } }, 10), null);
  assert.equal(leadProblem(form, { email: "not-an-email", name: "Ann" }), "Enter your email address.");
  assert.equal(leadProblem(form, { email: "ann@studio.com" }), "Enter your name.");
  assert.equal(leadProblem(form, { email: "ann@studio.com", name: "Ann" }), null);
  const csv = leadsCsv([{ created_at: "2026-10-24", name: "=HYPERLINK(1)", email: "ann@studio.com", phone: null, company: "A, B", message: null, page: 3, country: "GB" }]);
  assert.ok(csv.includes("'=HYPERLINK(1)"), "no formula injection");
  assert.ok(csv.includes('"A, B"'));
});

test("there are plenty of stickers, each with a known motion", () => {
  assert.ok(STICKERS.length >= 36);
  assert.equal(new Set(STICKERS.map((s) => s.id)).size, STICKERS.length);
});

const show: PageSlideshow = { id: "s1", page: 3, half: "left", x: 0.1, y: 0.2, width: 0.6, height: 0.4, images: ["slide_a", "slide_b"], interval: 4, transition: "fade", fit: "cover" };

test("slideshows are validated, kept on the page and their pictures publish with the portfolio", () => {
  assert.equal(validatePageSlideshow(show, 4), null);
  assert.ok(validatePageSlideshow({ ...show, page: 5 }, 4));
  assert.ok(validatePageSlideshow({ ...show, interval: 1 }, 4));
  assert.ok(validatePageSlideshow({ ...show, images: Array.from({ length: MAX_SLIDES + 1 }, (_, i) => `slide_${i}`) }, 4));
  assert.ok(validatePageSlideshow({ ...show, x: 0.6 }, 4), "the box must stay on the page");
  const placed = placeSlideshow(show, 0.9, 0.9, 0.01, 2);
  assert.equal(placed.width, SLIDESHOW_SIZE.min);
  assert.equal(placed.height, 1);
  assert.ok(placed.x + placed.width <= 1 && placed.y === 0);
  assert.equal(readablePageSlideshows([show, { ...show, fit: "stretch" }], 4).length, 1);
  assert.equal(slideshowsForLeaf([show], { page: 3, half: "right" }).length, 0);
  assert.equal(slideshowsForPage([show], 3, true)[0]!.width, 0.3);
  const keys = foldoutKeys({ slideshows: [show], pages: 4 });
  assert.ok(keys.includes("slide_a") && keys.includes("slide_b"));
});

test("your logo in the viewer is a Personal feature that publishes with the viewer", () => {
  const view = { brandLogoKey: "brand_x", brandLink: "https://studio.com/", brandLogoHeight: 40 };
  assert.ok(backgroundKeys(view as never).includes("brand_x"));
  const free = freeViewer(view as never) as { brandLogoKey?: string; brandLink?: string };
  assert.equal(free.brandLogoKey, undefined);
  assert.equal(free.brandLink, undefined);
});