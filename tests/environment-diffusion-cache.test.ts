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
  assert.equal(diffuser.apply(source, .5), first); assert.equal(draws, 3, "returning to an earlier light blend reuses its GPU texture");
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

test("diffusion cache bounds GPU targets and invalidates updated source textures",()=>{
  let draws=0;const targets: THREE.WebGLRenderTarget[]=[];
  const renderer={getRenderTarget:()=>null,setRenderTarget:(target:THREE.WebGLRenderTarget|null)=>{if(target)targets.push(target);},render:()=>{draws++;}} as unknown as THREE.WebGLRenderer;
  const diffuser=createEnvironmentDiffuser(renderer),source=new THREE.WebGLRenderTarget(16,16);
  diffuser.apply(source,.1);let disposed=0;targets[0]!.addEventListener("dispose",()=>disposed++);
  for(const value of [.2,.3,.4,.5])diffuser.apply(source,value);
  assert.equal(disposed,0,"least recently used GPU target is recycled without reallocating");
  assert.equal(new Set(targets).size,4,"scrubbing stays within four targets");
  diffuser.apply(source,.1);assert.equal(draws,6);
  source.texture.needsUpdate=true;diffuser.apply(source,.1);assert.equal(draws,7,"source changes cannot reuse a stale blend");
  diffuser.dispose();assert.equal(disposed,1,"recycled target is released when the viewer closes");source.dispose();
});
