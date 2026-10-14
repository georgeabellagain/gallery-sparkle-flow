import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {setNaturalImperfections,naturalPaperTexture,createAirDust} from "../src/lib/portfolia/natural-imperfections";
test("clear paper markings reuse one bitmap with mipmaps rather than per-pixel procedural noise",()=>{
 const texture=naturalPaperTexture();assert.equal(naturalPaperTexture(),texture);
 assert.equal(texture.image.width,512);assert.equal(texture.generateMipmaps,true);
 const pixels=texture.image.data as Uint8Array;
 let light=0,dark=255;for(let i=0;i<pixels.length;i+=4){light=Math.max(light,pixels[i]!);dark=Math.min(dark,pixels[i]!);}
 assert.ok(light-dark>60,"visible fibres/inclusions contrast with the paper");
 const mat=new THREE.MeshPhysicalMaterial({roughness:.97,clearcoat:0});setNaturalImperfections(mat,true);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
 mat.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
 assert.ok(shader.fragmentShader.includes("texture2D(naturalPaper,naturalUv)"));
 assert.ok(!shader.fragmentShader.includes("naturalHash"));assert.ok(!shader.fragmentShader.includes("fwidth(p.x)"));
 const uniforms=shader.uniforms as Record<string,{value:unknown}>;assert.equal(uniforms.naturalPaper.value,texture);
 const key=mat.customProgramCacheKey();setNaturalImperfections(mat,.25);assert.equal(uniforms.naturalAmount.value,.25);
 setNaturalImperfections(mat,false);assert.equal(uniforms.naturalAmount.value,0);assert.equal(mat.customProgramCacheKey(),key);
 assert.equal(mat.roughness,.97);assert.equal(mat.clearcoat,0);mat.dispose();
});
test("air dust is one bounded soft-particle batch with no continuous animation and releases its resources",()=>{
 const scene=new THREE.Scene(),dust=createAirDust(scene),points=scene.children[0] as THREE.Points;
 assert.equal(points.geometry.getAttribute("position").count,96);assert.equal(points.visible,false);
 const material=points.material as THREE.PointsMaterial;assert.equal(material.depthWrite,false);assert.equal(material.map!.image.width,32);
 dust.setIntensity(.5);assert.equal(points.visible,true);assert.equal(material.opacity,.325);
 dust.setIntensity(0);assert.equal(points.visible,false);
 let disposed=0;points.geometry.addEventListener("dispose",()=>disposed++);material.addEventListener("dispose",()=>disposed++);material.map!.addEventListener("dispose",()=>disposed++);
 dust.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,3);
});
