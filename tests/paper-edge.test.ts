import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {paperEdge} from '../src/lib/portfolia/paper-edge';
import {pageRelief} from '../src/lib/portfolia/page-relief';
import {turnGeometryWriter} from '../src/lib/portfolia/turn-geometry-cache';
test('crumpled edges are subtle, deterministic, paired and anchored at the spine',()=>{
 for(const seed of [1,3,5])for(let n=0;n<=32;n++){
  const d=n/32,v=1-n/32,edge=paperEdge(d,v,seed,true);
  assert.deepEqual(edge,paperEdge(d,v,seed+1,true),'two faces share one physical edge');
  assert.ok(Math.abs(edge.d-d)<.006);assert.ok(Math.abs(edge.v-v)<.003);
  assert.deepEqual(paperEdge(0,v,seed,true),{d:0,v});
  assert.deepEqual(paperEdge(d,v,seed,false),{d,v});
 }
 assert.notDeepEqual(paperEdge(1,.8,1,true),paperEdge(1,.8,3,true));
});
test('cached crumpled turn endpoints have exactly the same edge shape as resting pages',()=>{
 for(const dir of [1,-1] as const){
  const geometry=new THREE.PlaneGeometry(1,1.4,32,16),output=geometry.clone();
  const write=turnGeometryWriter(geometry,1.4,dir,[1,2],[1,2],.01,true),uv=geometry.getAttribute('uv');
  for(const progress of [0,1]){
   write(progress,output);const p=output.getAttribute('position');const side=progress===0?dir:-dir,seed=progress===0?1:2;
   for(let i=0;i<uv.count;i++){
    const d=uv.getX(i),v=uv.getY(i),edge=paperEdge(d,v,seed,true);
    assert.ok(Math.abs(p.getX(i)-side*edge.d)<1e-6);
    assert.ok(Math.abs(p.getY(i)-(edge.v-.5)*1.4)<1e-6);
    assert.ok(Math.abs(p.getZ(i)-pageRelief(d,v,seed))<1e-6);
   }
  }
  geometry.dispose();output.dispose();
 }
});
