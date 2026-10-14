import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createEnvironmentDiffuser } from "../src/lib/portfolia/environment-diffusion";
import { studioTopLight } from "../src/lib/portfolia/lighting";

test("diffusion reuses identical blends and refreshes changed lighting", () => {
  let draws = 0;
  const renderer = { getRenderTarget: () => null, setRenderTarget: () => {}, render: () => { draws++; } } as unknown as THREE.WebGLRenderer;
  const diffuser = createEnvironmentDiffuser(renderer), source = new THREE.WebGLRenderTarget(256, 256);
  const first = diffuser.apply(source, .5);
  assert.equal(diffuser.apply(source, .5), first); assert.equal(draws, 1);
  diffuser.apply(source, .6); assert.equal(draws, 2);
  diffuser.apply(source, .6, [.3, .4, .5]); assert.equal(draws, 3);
  diffuser.reset(); diffuser.apply(source, .6, [.3, .4, .5]); assert.equal(draws, 4);
  diffuser.dispose(); source.dispose();
});
test("white top light defaults off and stays within its intensity range", () => {
  assert.equal(studioTopLight(), 0);
  assert.equal(studioTopLight(-1), 0);
  assert.equal(studioTopLight(2), Math.PI);
  assert.equal(studioTopLight(.5), Math.PI / 2);
  assert.equal(studioTopLight(NaN), 0);
});
