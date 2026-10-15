import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createBookAntialias} from "../src/lib/portfolia/book-antialias";

test("MSAA uses two samples, retains display colour semantics, and follows drawing-buffer size",()=>{
  let current: THREE.WebGLRenderTarget | null=null;
  const draws: Array<{target:THREE.WebGLRenderTarget|null;scene:THREE.Scene}>=[];
  const renderer={capabilities:{maxSamples:4},outputColorSpace:THREE.SRGBColorSpace,
    getDrawingBufferSize:(v:THREE.Vector2)=>v.set(1600,900),
    setRenderTarget:(t:THREE.WebGLRenderTarget|null)=>{current=t;},
    render:(scene:THREE.Scene)=>draws.push({target:current,scene})} as unknown as THREE.WebGLRenderer;
  const aa=createBookAntialias(renderer), scene=new THREE.Scene();aa.render(scene,new THREE.Camera());
  const target=draws[0].target!;
  assert.equal(target.samples,2);assert.equal(target.width,1600);assert.equal(target.height,900);
  assert.equal(target.texture.colorSpace,THREE.SRGBColorSpace);assert.equal((target as THREE.WebGLRenderTarget & {isXRRenderTarget:boolean}).isXRRenderTarget,true);
  assert.equal(draws[1].target,null);
  const copy=draws[1].scene.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.RawShaderMaterial>;
  assert.equal(copy.material.toneMapped,false);assert.equal(copy.material.blending,THREE.NoBlending);
  aa.dispose();
});
