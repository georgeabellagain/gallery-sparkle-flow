import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { applyFastStudio, fastStudioFragment } from "../src/lib/portfolia/fast-studio";
import { applyPaperMaps } from "../src/lib/portfolia/paper-textures";
import { createTurnShade } from "../src/lib/portfolia/turn-shade";
import { createPageVideo } from "../src/lib/portfolia/page-video";

const shaderFor = (material: THREE.MeshStandardMaterial) => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
  return shader;
};
test("fast lighting drops BRDF lookup and specular environment evaluation but keeps normal-based diffuse", () => {
  const source = fastStudioFragment(THREE.ShaderLib.standard.fragmentShader);
  assert.ok(source.includes("#undef RE_IndirectSpecular"));
  assert.ok(!source.includes("texture2D( dfgLUT"));
  assert.ok(source.includes("irradiance + iblIrradiance"));
  assert.ok(source.includes("#include <normal_fragment_maps>"));
  assert.ok(source.includes("spotLightMap[ SPOT_LIGHT_MAP_INDEX ]"));
});
test("paper, video, and moving shadows compose with fast lighting in either hook order", () => {
  for (const fastFirst of [false, true]) {
    const m = new THREE.MeshStandardMaterial(), texture = new THREE.Texture();
    const video = createPageVideo();
    if (fastFirst) applyFastStudio(m);
    applyPaperMaps(m, "paper_0027", { colour: texture, normal: texture, roughness: texture });
    video.apply(m);
    createTurnShade().apply(m);
    if (!fastFirst) applyFastStudio(m);
    const shader = shaderFor(m);
    for (const code of ["fastStudioDirect", "paperInkSpecular", "pageVideoColour", "turnShadeK"])
      assert.ok(shader.fragmentShader.includes(code), code);
    video.dispose(); texture.dispose(); m.dispose();
  }
});
test("cloned notes receive their own shader hook; repeated decoration does not accumulate", () => {
  const original = new THREE.MeshStandardMaterial();
  applyFastStudio(original);
  const clone = original.clone();
  applyFastStudio(clone); applyFastStudio(clone);
  const shader = shaderFor(clone);
  assert.equal(shader.fragmentShader.split("void fastStudioDirect").length - 1, 1);
  assert.ok(clone.customProgramCacheKey().endsWith("_fast_studio_v1"));
  clone.dispose(); original.dispose();
});
