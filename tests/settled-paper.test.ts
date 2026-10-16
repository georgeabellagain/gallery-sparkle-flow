import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSettledPaperCache} from '../src/lib/portfolia/settled-paper';
import {updatePaperTangents} from '../src/lib/portfolia/paper-tangents';
import {bakeTurnGeometry,applyTurnPose,turnGeometryWriter,restingTurnNormals} from '../src/lib/portfolia/turn-geometry-cache';
test('landed paper retains the exact inverted turn-face normal frame when revisited',()=>{
 for(const dir of [1,-1] as const){
  const geometry=new THREE.PlaneGeometry(1,1.4,32,16);
  const frames=bakeTurnGeometry(geometry,turnGeometryWriter(geometry,1.4,dir,[2,3],[2,3],.01),8,[restingTurnNormals(geometry,1.4,dir,2,dir),restingTurnNormals(geometry,1.4,-dir as 1|-1,3,-dir)]);
  for(const progress of [0,1]){
   applyTurnPose(frames,progress,geometry);
   const side=progress===0?dir:-dir;
   const faceGeometry=geometry.clone();
   if(side===-1){const uv=faceGeometry.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
   updatePaperTangents(faceGeometry,side===-1);
   const face=new THREE.Mesh(faceGeometry,new THREE.MeshStandardMaterial({side:side===-1?THREE.BackSide:THREE.FrontSide}));
   const resting=new THREE.Mesh(new THREE.PlaneGeometry(1,1.4,32,16),new THREE.MeshStandardMaterial());resting.position.x=side*.5;
   updatePaperTangents(resting.geometry);
   const existingBuffer=resting.geometry.getAttribute('position');
   const cache=createSettledPaperCache(),page={};cache.remember(page,face,resting.position);
   assert.equal(cache.apply(page,resting),true);assert.equal(resting.geometry.getAttribute('position'),existingBuffer,'reuse the GPU attribute buffers');
   assert.equal(resting.material.side,face.material.side);
   for(const name of ['normal','uv','tangent'])assert.deepEqual(Array.from(resting.geometry.getAttribute(name).array),Array.from(faceGeometry.getAttribute(name).array));
   if(side===-1)assert.ok(resting.geometry.getAttribute('normal').getZ(0)<0,'the raw normal remains inverted after landing');
   const before=Float32Array.from(resting.geometry.getAttribute('normal').array);
   (faceGeometry.getAttribute('normal') as THREE.BufferAttribute).setXYZ(0,1,0,0);
   cache.apply(page,resting);assert.deepEqual(resting.geometry.getAttribute('normal').array,before,'later turns cannot mutate the saved frame');
   const a=resting.geometry.getAttribute('position'),b=faceGeometry.getAttribute('position');
   for(let i=0;i<a.count;i++){assert.ok(Math.abs(a.getX(i)+resting.position.x-b.getX(i))<1e-7);assert.equal(a.getY(i),b.getY(i));assert.equal(a.getZ(i),b.getZ(i));}
   face.geometry.dispose();face.material.dispose();resting.geometry.dispose();resting.material.dispose();
  }
  geometry.dispose();
 }
});
