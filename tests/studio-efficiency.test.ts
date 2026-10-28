import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createResourceCache } from "../src/lib/portfolia/resource-cache";
import { createEnvironmentDiffuser } from "../src/lib/portfolia/environment-diffusion";
import { studioSettingsChange } from "../src/lib/portfolia/studio-settings-change";
import type { StudioSettings } from "../src/lib/portfolia/book-scene";
const settings: StudioSettings = { studio: true, material: "satin", brightness: .5, hdri: "4", simpleShadow: true, simpleShadowOpacity: .2 };
test("brightness and fill preserve shadow/material setup; all visual changes still reconfigure", () => {
  assert.equal(studioSettingsChange(settings, { ...settings }), "none");
  assert.equal(studioSettingsChange(settings, { ...settings, turnSpeed: 1.5, turnCurve: "deep" as StudioSettings["turnCurve"] }), "none");
  assert.equal(studioSettingsChange(settings, { ...settings, brightness: 1, topLight: .3 }), "exposure");
  for (const patch of [{ hdri: "5" }, { strength: .2 }, { material: "matte" }, { studio: false }, { bookStyle: "hardback" }, { tabStyle: "ribbon" }])
    assert.equal(studioSettingsChange(settings, { ...settings, ...patch } as StudioSettings), "full");
});
test("lighting cache evicts least-used maps while protecting the displayed and incoming light", () => {
  const released: number[] = [], cache = createResourceCache<string, number>(3, value => released.push(value));
  cache.set("a", 1); cache.set("b", 2); cache.set("c", 3);
  cache.get("a"); cache.set("d", 4); cache.trim(["b", "d"]);
  assert.deepEqual(released, [3]); assert.equal(cache.size, 3);
  assert.equal(cache.get("b"), 2);
  cache.set("a", 5); assert.deepEqual(released, [3, 1]);
  cache.clear(); assert.equal(cache.size, 0);
  assert.equal(new Set(released).size, released.length);
});
test("diffusion scrubbing reuses four GPU targets and cached results avoid draw calls", () => {
  let draws = 0, current: THREE.WebGLRenderTarget | null = null;
  const renderer = { getRenderTarget: () => current, setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { current = target; }, render: () => { draws++; } } as unknown as THREE.WebGLRenderer;
  const diffuser = createEnvironmentDiffuser(renderer), source = new THREE.WebGLRenderTarget(32, 16);
  const textures = new Set<THREE.Texture>();
  for (let i = 0; i < 20; i++) textures.add(diffuser.apply(source, i / 100));
  assert.equal(textures.size, 4); assert.equal(draws, 20);
  diffuser.apply(source, .19); assert.equal(draws, 20);
  assert.equal(diffuser.apply(source, 1), source.texture); assert.equal(draws, 20);
  diffuser.releaseSource(source);
  diffuser.apply(source, .19); assert.equal(draws, 21);
  assert.equal(current, null);
  diffuser.dispose(); source.dispose();
});
test("diffusion failures restore the previous render target and allow retry", () => {
  const previous = new THREE.WebGLRenderTarget(8, 8), source = new THREE.WebGLRenderTarget(32, 16);
  let current: THREE.WebGLRenderTarget | null = previous, fail = true;
  const renderer = { getRenderTarget: () => current, setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { current = target; }, render: () => { if (fail) throw Error("context lost"); } } as unknown as THREE.WebGLRenderer;
  const diffuser = createEnvironmentDiffuser(renderer);
  assert.throws(() => diffuser.apply(source, .5)); assert.equal(current, previous);
  fail = false; assert.ok(diffuser.apply(source, .5)); assert.equal(current, previous);
  diffuser.dispose(); previous.dispose(); source.dispose();
});
