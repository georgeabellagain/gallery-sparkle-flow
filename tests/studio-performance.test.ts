import test from "node:test";
import assert from "node:assert/strict";
import {studioMotionBudget, bookSurfaceRatio} from "../src/lib/portfolia/render-budget";
import * as THREE from "three";
import {createBookBinding} from "../src/lib/portfolia/book-binding";

test("Studio motion halves large surface work, while settled, Simple and capture stay sharp",()=>{
  assert.equal(studioMotionBudget(5_200_000,true,true),2_600_000);
  assert.equal(studioMotionBudget(2_500_000,true,true),1_500_000);
  for(const moving of [false,true])assert.equal(studioMotionBudget(5_200_000,moving,false),5_200_000);
  assert.equal(studioMotionBudget(5_200_000,false,true),5_200_000);
  assert.equal(studioMotionBudget(5_200_000,true,true,true),5_200_000);
  const pixels=(budget:number)=>1920*1080*bookSurfaceRatio(1920,1080,2,budget)**2;
  assert.ok(Math.abs(pixels(studioMotionBudget(5_200_000,true,true))/pixels(5_200_000)-.5)<1e-8);
  assert.equal(studioMotionBudget(500_000,true,true),500_000);
});

test("camera-only frames reuse page-layer buffers; spread and settings changes invalidate them",()=>{
  const book=new THREE.Group(),binding=createBookBinding(book,1.4);
  const layout:[{kind:"page";share:number;leaf:number},{kind:"page";share:number;leaf:number}]=[{kind:"page",share:.3,leaf:10},{kind:"page",share:.7,leaf:11}];
  binding.setLeaves(40);binding.set("softcover",true,true);binding.sync([true,true],layout);
  const layers:THREE.InstancedMesh[]=[];book.traverse(o=>{if(o instanceof THREE.InstancedMesh)layers.push(o);});
  const versions=layers.map(layer=>layer.instanceMatrix.version);
  for(let i=0;i<120;i++)binding.sync([true,true],layout);
  assert.deepEqual(layers.map(layer=>layer.instanceMatrix.version),versions);
  layout[0].share=.4;binding.sync([true,true],layout);
  assert.ok(layers.every((layer,i)=>layer.instanceMatrix.version>versions[i]!));
  const changed=layers[0]!.instanceMatrix.version;
  binding.setLeaves(80);binding.sync([true,true],layout);assert.ok(layers[0]!.instanceMatrix.version>changed);
  binding.sync([false,true],layout);assert.equal(book.children[0]!.children[0]!.visible,false);
  binding.set("flipbook",false,false);binding.sync([true,true],layout);assert.equal(book.children[0]!.visible,false);
  binding.dispose();
});
