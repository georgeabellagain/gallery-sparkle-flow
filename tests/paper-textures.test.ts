import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import * as THREE from "three";
import { applyPaperMaps, paperTextureId } from "../src/lib/portfolia/paper-textures";
import { paperFinish } from "../src/lib/portfolia/surface";

test("both uploaded stocks preserve their saved selection and have complete surface maps", () => {
  for (const id of ["paper_0022", "paper_0027"] as const) {
    assert.equal(paperFinish(id), id);
    assert.equal(paperTextureId(id), id);
    for (const map of ["colour", "normal", "roughness"]) assert.ok(existsSync(`public/studio/paper/${id}-${map}.webp`));
  }
  assert.equal(paperTextureId("matte"), undefined);
});
test("paper maps preserve artwork, share GPU maps and clear on switching to matte", () => {
  const artwork = new THREE.Texture(), material = new THREE.MeshStandardMaterial({map:artwork});
  const maps = {colour:new THREE.Texture(),normal:new THREE.Texture(),roughness:new THREE.Texture()};
  applyPaperMaps(material,"paper_0022",maps);
  assert.equal(material.normalScale.x,.16);
  assert.equal(material.map,artwork);
  assert.equal(material.normalMap,maps.normal); assert.equal(material.roughnessMap,maps.roughness);
  const hook = material.onBeforeCompile;
  const other = new THREE.MeshStandardMaterial();applyPaperMaps(other,"paper_0022",maps);
  assert.equal(other.normalMap,material.normalMap);
  applyPaperMaps(material,"paper_0027",maps);
  assert.equal(material.onBeforeCompile,hook,"switching stock reuses the shader");
  applyPaperMaps(material,"matte");
  assert.equal(material.normalMap,null);assert.equal(material.roughnessMap,null);
  assert.equal(material.roughness,.97);assert.equal(material.map,artwork);
  applyPaperMaps(material,"satin");assert.equal(material.roughness,.42);
});

test("paper loading is deduplicated and cannot reapply a stale selection", async () => {
  const { createPaperTextures } = await import("../src/lib/portfolia/paper-textures");
  const original = THREE.TextureLoader.prototype.loadAsync;
  const loaded: THREE.Texture[] = [];
  THREE.TextureLoader.prototype.loadAsync = async () => {
    const t = new THREE.Texture() as THREE.Texture<HTMLImageElement>; loaded.push(t); return t;
  };
  const cache = createPaperTextures(() => {});
  try {
    const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial();
    cache.apply(a,"paper_0022");cache.apply(b,"paper_0022");cache.apply(a,"matte");
    await cache.ready();
    assert.equal(loaded.length,3);
    assert.equal(a.normalMap,null,"finishing an old load does not change the current stock");
    assert.equal(b.normalMap,loaded[1]);
    for (const t of loaded) { assert.equal(t.repeat.x,.5); assert.equal(t.repeat.y,.5); assert.equal(t.offset.x,.25); }
    assert.equal(loaded[0]!.colorSpace,THREE.SRGBColorSpace);
    assert.equal(loaded[1]!.colorSpace,THREE.NoColorSpace);
    cache.apply(a,"paper_0022");assert.equal(a.normalMap,b.normalMap);assert.equal(loaded.length,3);
    let released=0;loaded.forEach(t=>t.addEventListener("dispose",()=>released++));
    cache.dispose();assert.equal(released,3);
  } finally { THREE.TextureLoader.prototype.loadAsync=original;cache.dispose(); }
});

test("paper shader protects text across colour, roughness and surface lighting", () => {
  const material = new THREE.MeshStandardMaterial();
  const maps = {colour:new THREE.Texture(),normal:new THREE.Texture(),roughness:new THREE.Texture()};
  applyPaperMaps(material,"paper_0027",maps);
  const shader = {
    uniforms:{}, vertexShader:"#include <uv_vertex>",
    fragmentShader:"#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>",
  };
  material.onBeforeCompile(shader as unknown as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
  assert.ok(shader.fragmentShader.includes("fwidth(paperInkLuma)"),"screen-space text edges suppress relief");
  assert.ok(shader.fragmentShader.includes("smoothstep(.6,.95,paperInkLuma)"),"dark ink keeps smooth lighting");
  assert.ok(shader.fragmentShader.includes("mix(.97,roughnessFactor,paperStockMask)"));
  assert.ok(shader.fragmentShader.includes("mix(nonPerturbedNormal,normal,paperStockMask)"));
  assert.equal(material.normalScale.x,.22);
});
