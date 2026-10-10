import test from "node:test";
import assert from "node:assert/strict";
import { hostOf, linkName, linksForPage, normaliseUrl, readablePageLinks, readablePageTags, siteIconUrl, tabSlots, validatePageLink, validatePageTag, type PageLink } from "../src/lib/portfolia/page-extras";

const link: PageLink = { id: "l1", page: 2, half: "left", url: "https://behance.net/me", x: 0.1, y: 0.1, size: 0.12 };

test("shared links retain position on full pages and map spread halves", () => {
  assert.deepEqual(linksForPage([link], 2, false), [link]);
  assert.deepEqual(linksForPage([link], 1, true), []);
  assert.equal(linksForPage([link], 2, true)[0]?.x, 0.05);
  const right = linksForPage([{ ...link, half: "right" }], 2, true)[0];
  assert.equal(right?.x, 0.55);
  assert.equal(right?.size, 0.06);
  assert.equal(right?.y, link.y);
  assert.equal(link.size, 0.12);
});

test("tab edge positions are optional, persisted and bounded", () => {
  const tag = { id: "a", page: 1, label: "Work", colour: "#4fa3d1", position: 0.2 };
  assert.equal(validatePageTag(tag, 3), null);
  assert.equal(readablePageTags([tag], 3)[0]?.position, 0.2);
  for (const position of [-0.1, 1.1, NaN, Infinity]) assert.ok(validatePageTag({ ...tag, position }, 3));
});

import { tabSlot } from "../src/lib/portfolia/tab-geometry";
test("custom tab positioning keeps the whole tab on the edge", () => {
  const top = tabSlot(1.4, 0, 3, 0);
  const bottom = tabSlot(1.4, 0, 3, 1);
  assert.equal(top.y + top.height / 2, 0.7);
  assert.equal(bottom.y - bottom.height / 2, -0.7);
  assert.equal(tabSlot(1.4, 0, 3, 0.5).y, 0);
  assert.notEqual(tabSlot(1.4, 0, 3).y, tabSlot(1.4, 2, 3).y);
});

test("web addresses are made safe", () => {
  assert.equal(normaliseUrl("behance.net/me"), "https://behance.net/me");
  assert.equal(normaliseUrl("  https://www.instagram.com/a "), "https://www.instagram.com/a");
  assert.equal(normaliseUrl("http://example.com"), "http://example.com/");
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "", "not a url", "localhost", "https://u:p@site.com", "mailto:a@b.com"])
    assert.equal(normaliseUrl(bad), null, bad);
});
test("host and logo address", () => {
  assert.equal(hostOf("https://www.behance.net/me"), "behance.net");
  assert.match(siteIconUrl("https://www.behance.net/me"), /host=behance\.net/);
  assert.equal(linkName(link), "behance.net");
  assert.equal(linkName({ ...link, label: "My work" }), "My work");
});
test("links validate and unsafe ones are dropped", () => {
  assert.equal(validatePageLink(link, 3), null);
  assert.ok(validatePageLink({ ...link, page: 4 }, 3));
  assert.ok(validatePageLink({ ...link, url: "javascript:alert(1)" }, 3));
  assert.ok(validatePageLink({ ...link, size: 0.9 }, 3));
  assert.deepEqual(readablePageLinks([link, link, { ...link, id: "l2", url: "javascript:x" }], 3).map((l) => l.id), ["l1"]);
  assert.deepEqual(readablePageLinks("nope", 3), []);
});
test("tags validate, de-duplicate and keep page order", () => {
  const tags = [
    { id: "b", page: 3, label: "Contact", colour: "#e8604c" },
    { id: "a", page: 1, label: "", colour: "#4fa3d1" },
    { id: "a", page: 2, label: "dup", colour: "#4fa3d1" },
    { id: "c", page: 9, label: "far", colour: "#4fa3d1" },
  ];
  const ok = readablePageTags(tags, 3);
  assert.deepEqual(ok.map((t) => t.id), ["b", "a"]);
  assert.deepEqual(tabSlots(ok).map((t) => [t.id, t.slot, t.of]), [["a", 0, 2], ["b", 1, 2]]);
});

import { layoutNoteText } from "../src/lib/portfolia/note-text";
test("note text wraps, keeps paragraph ends, and shrinks to fit", () => {
  const measure = (s: string, size: number) => s.length * size * 0.5;
  const { lines, size } = layoutNoteText("one two three four\nfive", 100, 200, 20, measure);
  assert.ok(lines.length >= 2);
  assert.equal(lines.filter((l) => l.last).length, 2);
  assert.ok(lines.every((l) => measure(l.text, size) <= 100));
  const tight = layoutNoteText("word ".repeat(60), 100, 60, 20, measure);
  assert.ok(tight.size < 20);
  assert.ok(tight.lines.length * tight.size * 1.3 <= 60 + 1e-6 || tight.size < 1);
});

import { tabEdge } from "../src/lib/portfolia/tab-geometry";
test("tabs stick out of the edge their page lies toward", () => {
  assert.equal(tabEdge(3, [null, 0], false), "right");
  assert.equal(tabEdge(5, [1, 2], false), "right");
  assert.equal(tabEdge(0, [1, 2], false), "left");
  assert.equal(tabEdge(1, [1, 2], false), "left");
  assert.equal(tabEdge(2, [1, 2], false), "right");
  assert.equal(tabEdge(1, [5, null], false), "left");
  assert.equal(tabEdge(2, [null, 4], true), "right");
});

import { paintPageLinks, iconKeyOf } from "../src/lib/portfolia/link-paint";
test("links are printed flat on the page, with no shadow, at their place", () => {
  const calls: string[] = [];
  const shadows: unknown[] = [];
  const ctx = new Proxy({}, {
    get: (_t, name: string) => (name === "measureText" ? () => ({ width: 10 }) : (...args: unknown[]) => { calls.push(`${name}:${args.join(",")}`); },),
    set: (_t, name: string, value) => { if (name.startsWith("shadow")) shadows.push(value); return true; },
  }) as unknown as CanvasRenderingContext2D;
  const link: PageLink = { id: "l", page: 1, half: "right", url: "https://behance.net/me", x: 0.1, y: 0.2, size: 0.1, label: "Work" };
  paintPageLinks(ctx, 1000, 1400, [link], new Map());
  assert.deepEqual(shadows, []);
  // letter tile + caption, starting at x=100, y=280
  assert.ok(calls.some((c) => c === "moveTo:122,280"));
  assert.ok(calls.some((c) => c.startsWith("fillText:W,")));
  assert.ok(calls.some((c) => c.startsWith("fillText:Work,")));
  assert.equal(iconKeyOf(link), "site:behance.net");
  assert.equal(iconKeyOf({ ...link, iconKey: "k1" }), "own:k1");
});
