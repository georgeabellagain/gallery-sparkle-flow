import test from "node:test";
import assert from "node:assert/strict";
import { hostOf, linkName, normaliseUrl, readablePageLinks, readablePageTags, siteIconUrl, tabSlots, validatePageLink, type PageLink } from "../src/lib/portfolia/page-extras";

const link: PageLink = { id: "l1", page: 2, half: "left", url: "https://behance.net/me", x: 0.1, y: 0.1, size: 0.12 };

test("web addresses are made safe", () => {
  assert.equal(normaliseUrl("behance.net/me"), "https://behance.net/me");
  assert.equal(normaliseUrl("  https://www.instagram.com/a "), "https://www.instagram.com/a");
  assert.equal(normaliseUrl("http://example.com"), "http://example.com/");
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "", "not a url", "localhost", "https://u:p@site.com", "mailto:a@b.com"])
    assert.equal(normaliseUrl(bad), null, bad);
});
test("host and logo address", () => {
  assert.equal(hostOf("https://www.behance.net/me"), "behance.net");
  assert.match(siteIconUrl("https://www.behance.net/me"), /domain=behance\.net/);
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

import { tabEdge } from "../src/lib/portfolia/page-extras";
test("tabs stick out of the edge their page lies toward", () => {
  // closed front cover: spread [null, 0]
  assert.equal(tabEdge(3, [null, 0], false, 0), "right");
  // open on leaves 1|2
  assert.equal(tabEdge(5, [1, 2], false, 1), "right");
  assert.equal(tabEdge(0, [1, 2], false, 1), "left");
  assert.equal(tabEdge(1, [1, 2], false, 1), "left");
  assert.equal(tabEdge(2, [1, 2], false, 1), "right");
  // back cover [n, null]
  assert.equal(tabEdge(1, [5, null], false, 5), "left");
  // phone: single page
  assert.equal(tabEdge(2, [null, 4], true, 4), "left");
  assert.equal(tabEdge(6, [null, 4], true, 4), "right");
});
