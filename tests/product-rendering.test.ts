import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {softFold} from '../src/lib/portfolia/turn-curve';
import {photoSurfaceScale} from '../src/lib/portfolia/photo-surface-scale';
import {createTurnSelfShade} from '../src/lib/portfolia/turn-self-shade';

test('automatic soft folds keep a straight edge and settle flat in both directions',()=>{
  for(const p of [0,.1,.4,.7,.9,1]) for(const u of [0,.3,.8,1]) {
    const first=softFold(u,0,p);
    for(const v of [.2,.5,.9,1]) assert.deepEqual(softFold(u,v,p),first);
    if(p===0||p===1){assert.ok(Math.abs(first.z)<1e-10);assert.ok(Math.abs(first.x-(p===0?u:-u))<1e-10);}
  }
});
test('photo surface defaults to half size and bounds invalid remembered values',()=>{
  assert.equal(photoSurfaceScale(),.5);assert.equal(photoSurfaceScale(NaN),.5);
  assert.equal(photoSurfaceScale(.75),.75);assert.equal(photoSurfaceScale(-1),.1);assert.equal(photoSurfaceScale(20),2);
});
test('moving sheet shade composes with existing material hooks and clears at rest',()=>{
  const shade=createTurnSelfShade(),mat=new THREE.MeshStandardMaterial();
  let called=false;mat.onBeforeCompile=()=>{called=true;};shade.apply(mat);
  const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>',fragmentShader:'#include <color_fragment>\n#include <emissivemap_fragment>'} as any;
  mat.onBeforeCompile(shader,{} as any);assert.ok(called);
  shade.drive(.5);assert.equal(shader.uniforms.turnSelfShade.value,.32);
  assert.match(shader.fragmentShader,/totalEmissiveRadiance \*= foldLight/);
  shade.clear();assert.equal(shader.uniforms.turnSelfShade.value,0);mat.dispose();
});
