import { test } from "node:test";
import assert from "node:assert/strict";
import { countryName, deviceOf, isBotAgent, openedWhen } from "../src/lib/portfolia/open-notify";
import { publicPortfolioPlan } from "../src/lib/portfolia/public-assets";
import type { Portfolio } from "../src/lib/portfolia/store";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const ipad = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const androidTablet = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";
const androidPhone = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";

test("device types read from the browser's user agent", () => {
  assert.equal(deviceOf(iphone), "phone");
  assert.equal(deviceOf(androidPhone), "phone");
  assert.equal(deviceOf(ipad), "tablet");
  assert.equal(deviceOf(androidTablet), "tablet");
  assert.equal(deviceOf(mac), "computer");
});

test("link previews, crawlers, scripts and empty agents never count as an open", () => {
  for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23", "Slackbot-LinkExpanding 1.0", "curl/8.4", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/128", "", null]) assert.ok(isBotAgent(ua), String(ua));
  for (const ua of [iphone, mac, androidTablet]) assert.equal(isBotAgent(ua), false);
});

test("country codes become names; unknown and Tor codes give nothing", () => {
  assert.equal(countryName("GB"), "the United Kingdom");
  assert.equal(countryName("NL"), "the Netherlands");
  assert.equal(countryName("FR"), "France");
  assert.equal(countryName("XX"), undefined);
  assert.equal(countryName("T1"), undefined);
  assert.equal(countryName("gb"), undefined);
  assert.equal(countryName(null), undefined);
});

test("the time is written plainly in UTC", () => {
  assert.equal(openedWhen(new Date("2026-10-22T14:05:00Z")), "on 22 October 2026 at 14:05 UTC");
});

test("visitors never see whether the owner gets open emails", () => {
  const p = { code: "abc", notifyOnOpen: true, profile: { links: [] }, pdf: null } as unknown as Portfolio;
  assert.equal(publicPortfolioPlan(p, true).notifyOnOpen, undefined);
  assert.equal(publicPortfolioPlan(p, false).notifyOnOpen, undefined);
});
