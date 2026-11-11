import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { KNOWN_ASSET_NAMES, MARKETING_ASSETS } from "../src/lib/portfolia/marketing-assets";

test("every listed marketing asset has its files within the size limits", () => {
  for (const a of MARKETING_ASSETS) {
    assert.ok(KNOWN_ASSET_NAMES.includes(a.name as never), `${a.name} is a known name`);
    assert.ok(a.alt.length > 5 && a.width > 0 && a.height > 0, `${a.name} has alt and size`);
    if (a.kind === "image") {
      for (const w of [800, 1600]) assert.ok(existsSync(`public/marketing/${a.name}-${w}.webp`), `${a.name}-${w}.webp`);
    } else {
      assert.ok(existsSync(`public/marketing/${a.name}.mp4`) && existsSync(`public/marketing/${a.name}-poster.webp`), `${a.name} clip and poster`);
      assert.ok(statSync(`public/marketing/${a.name}.mp4`).size <= 1.5 * 1048576, `${a.name} clip is at most 1.5 MB`);
    }
  }
});

test("every MarketingImage or MarketingClip name used in src is a known asset", () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".tsx") ? [`${dir}/${e.name}`] : []);
  for (const file of walk("src")) {
    for (const m of readFileSync(file, "utf8").matchAll(/<Marketing(?:Image|Clip)\b[^>]*\bname="([^"]+)"/g)) {
      assert.ok(KNOWN_ASSET_NAMES.includes(m[1] as never), `${file} uses unknown asset ${m[1]}`);
    }
  }
});

test("marketing components never render an image without alt, width and height", () => {
  const media = readFileSync("src/components/pf/Media.tsx", "utf8");
  for (const tag of media.match(/<img[^>]*>/g) ?? []) assert.ok(/alt=/.test(tag) && /width=/.test(tag) && /height=/.test(tag), tag);
});
