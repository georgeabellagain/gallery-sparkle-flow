import { test } from "node:test";
import assert from "node:assert/strict";
import { HOTSPOT_SIZE, hotspotHeight, hotspotStartSize, placeHotspot, validatePageHotspot, videoPlayUrl, videoThumbnail, type PageHotspot } from "../src/lib/portfolia/page-extras";
import { pageFromHash } from "../src/lib/portfolia/page-link";
import { createReadingTracker } from "../src/lib/portfolia/reading-tracker";
import { deviceOf, sourceOf, type ReadingRow } from "../src/lib/portfolia/reading.functions";
import { duration, readingCsv, summariseReading } from "../src/lib/portfolia/reading-insights";

const base: PageHotspot = { id: "h1", page: 1, half: "left", style: "info", x: 0.2, y: 0.2, size: HOTSPOT_SIZE.info, colour: "#1c1c1c", action: "popup", title: "Materials", text: "Recycled card" };

test("info icons and on-page video players are hotspots with their own shapes", () => {
  assert.equal(validatePageHotspot(base, 3), null);
  const video: PageHotspot = { ...base, style: "video", size: hotspotStartSize("video"), video: "https://youtu.be/dQw4w9WgXcQ", autoplay: true };
  assert.equal(validatePageHotspot(video, 3), null);
  assert.ok(validatePageHotspot({ ...video, video: "https://example.com/clip" }, 3));
  assert.ok(validatePageHotspot({ ...video, autoplay: "yes" as never }, 3));
  assert.equal(hotspotHeight({ style: "info", size: 0.1 }, 1), 0.1, "round like a dot");
  assert.equal(hotspotHeight({ style: "video", size: 0.8 }, 1), 0.45, "16:9");
  const kept = placeHotspot(video, 0.9, 0.95, 0.6, 1.4);
  assert.ok(kept.x + kept.size <= 1 && kept.y + hotspotHeight(kept, 1.4) <= 1.0001, "a video stays on the page");
});

test("videos play privately: a still picture first, then the player, muted when it starts by itself", () => {
  assert.equal(videoThumbnail("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(videoThumbnail("https://vimeo.com/123456789"), null);
  assert.equal(videoPlayUrl("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0&modestbranding=1");
  assert.equal(videoPlayUrl("https://vimeo.com/123456789", true), "https://player.vimeo.com/video/123456789?dnt=1&autoplay=1&playsinline=1&mute=1&muted=1");
  assert.equal(videoPlayUrl("not a link"), null);
});

test("shared links can open on a page", () => {
  assert.equal(pageFromHash("#page=5"), 5);
  assert.equal(pageFromHash("#p12"), 12);
  assert.equal(pageFromHash("#project_ab12"), undefined);
  assert.equal(pageFromHash(""), undefined);
});

test("the reading tracker notes pages, visible time and presses, and sends them in batches", () => {
  let clock = 0;
  const sent: unknown[][] = [];
  const t = createReadingTracker((batch) => sent.push(batch), () => clock);
  t.page(1);
  clock = 12_000;
  t.page(2);
  t.click("shop.com/item");
  clock = 20_000;
  t.visibility(false); // the tab is hidden: time on page 2 is counted, then everything is sent
  clock = 500_000;
  t.visibility(true); // time hidden is not counted
  clock = 503_000;
  t.page(3);
  t.flush();
  assert.deepEqual(sent[0], [{ kind: "page", page: 1 }, { kind: "time", page: 1, seconds: 12 }, { kind: "page", page: 2 }, { kind: "click", page: 2, target: "shop.com/item" }, { kind: "time", page: 2, seconds: 8 }]);
  assert.deepEqual(sent[1], [{ kind: "time", page: 2, seconds: 3 }, { kind: "page", page: 3 }]);
});

test("devices and referring sites are worked out without keeping anything personal", () => {
  assert.equal(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile"), "phone");
  assert.equal(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
  assert.equal(sourceOf("https://l.instagram.com/?u=secret", "portfolia.site"), "instagram.com");
  assert.equal(sourceOf("https://portfolia.site/dashboard", "portfolia.site"), null);
  assert.equal(sourceOf("nonsense", "portfolia.site"), null);
});

test("reader insights add up readers, pages, time, clicks and audiences", () => {
  const row = (r: Partial<ReadingRow>): ReadingRow => ({ kind: "page", page: null, target: null, seconds: null, device: "desktop", country: "GB", source: null, visitor: "a", created_at: "2026-10-27T10:00:00Z", ...r });
  const rows = [
    row({ page: 1 }), row({ kind: "time", page: 1, seconds: 30 }), row({ page: 4 }), row({ kind: "time", page: 4, seconds: 10 }), row({ kind: "click", page: 4, target: "shop.com" }),
    row({ visitor: "b", page: 1, device: "phone", country: "US", source: "instagram.com" }), row({ visitor: "b", kind: "time", page: 1, seconds: 20, device: "phone" }), row({ visitor: "b", kind: "play", page: 1, target: "Trailer", device: "phone" }),
  ];
  const s = summariseReading(rows, 4);
  assert.equal(s.readers, 2);
  assert.equal(s.pageViews, 3);
  assert.equal(s.averageSeconds, 30);
  assert.equal(s.finished, 0.5);
  assert.deepEqual(s.pages.map((p) => [p.page, p.views, p.averageSeconds]), [[1, 2, 25], [4, 1, 10]]);
  assert.deepEqual(s.clicks, [{ name: "shop.com", count: 1 }]);
  assert.deepEqual(s.plays, [{ name: "Trailer", count: 1 }]);
  assert.deepEqual(s.devices.map((d) => d.name).sort(), ["desktop", "phone"]);
  assert.deepEqual(s.sources.find((x) => x.name === "instagram.com")?.count, 1);
  assert.equal(readingCsv([row({ target: 'say "hi", ok' })]).split("\n")[1], '2026-10-27T10:00:00Z,page,,"say ""hi"", ok",,desktop,GB,,a');
  assert.equal(duration(65), "1m 05s");
});
