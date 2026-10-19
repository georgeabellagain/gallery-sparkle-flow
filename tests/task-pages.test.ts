import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { TASK_PAGES, taskContent } from "../src/lib/portfolia/task-pages";
import { RESERVED } from "../src/lib/portfolia/store";

test("task landing pages are wired, reserved and sized for search results", () => {
  const titles = new Set<string>();
  // SEO_LINKS lives beside the discipline pages; read the source so the test stays independent of render order.
  const links = readFileSync("src/lib/portfolia/seo-pages.ts", "utf8");
  assert.ok(links.includes("TASK_PAGES"), "related-guide links include the task pages");
  for (const slug of Object.keys(TASK_PAGES)) {
    const c = taskContent(slug);
    assert.equal(c.path, `/${slug}`);
    assert.ok(existsSync(`src/routes/${slug}.tsx`), `route file for ${slug}`);
    assert.ok(RESERVED.includes(slug), `${slug} cannot be claimed as a personal address`);
    assert.ok(c.title.length <= 72, `${slug} title fits search results (${c.title.length})`);
    assert.ok(c.description.length >= 110 && c.description.length <= 160, `${slug} description length (${c.description.length})`);
    assert.ok(!titles.has(c.title), `${slug} title is unique`); titles.add(c.title);
    assert.ok(c.points.length === 3 && c.steps.length >= 3 && c.faqs.length >= 3);
  }
});
