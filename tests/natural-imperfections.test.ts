import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {setNaturalImperfections} from "../src/lib/portfolia/natural-imperfections";
test("one reversible toggle controls the paper treatment without changing matte material or shader identity",()=>{
  const material=new THREE.MeshPhysicalMaterial({roughness:.97,clearcoat:0});
  setNaturalImperfections(material,true);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
  material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
  const uniforms=shader.uniforms as Record<string,{value:number}>;
  assert.equal(uniforms.naturalAmount.value,1);
  assert.ok(shader.fragmentShader.includes("float fibre"));
  assert.ok(shader.fragmentShader.includes("float wear"));
  assert.ok(shader.fragmentShader.includes("float variation"));
  const key=material.customProgramCacheKey();
  setNaturalImperfections(material,false);
  assert.equal(uniforms.naturalAmount.value,0);
  assert.equal(material.customProgramCacheKey(),key);
  assert.equal(material.roughness,.97);assert.equal(material.clearcoat,0);
  material.dispose();
});
test("backdrop dust is applied after lighting so it also works on an unlit photograph",()=>{
  const material=new THREE.MeshStandardMaterial();setNaturalImperfections(material,true,"backdrop");
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
  assert.ok(shader.fragmentShader.indexOf("float speck")<shader.fragmentShader.indexOf("#include <opaque_fragment>"));
  assert.ok(shader.fragmentShader.includes("outgoingLight *= 1.0-speck*.12"));material.dispose();
});
