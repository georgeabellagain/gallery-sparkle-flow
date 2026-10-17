import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { rigidCoverWriter,coverLeaf,COVER_HEIGHT,COVER_OVERHANG } from "../src/lib/portfolia/rigid-cover";
import { createBookBinding } from "../src/lib/portfolia/book-binding";

test("front and back boards include their reverse printed faces only",()=>{
 for(let i=0;i<14;i++)assert.equal(coverLeaf(i,14),[0,1,12,13].includes(i));
});
test("hardback covers rotate as enlarged planes without any bend in either direction",()=>{
 for(const dir of [1,-1] as const)for(const ratio of [.7,1.4,2]){
  const geometry=new THREE.PlaneGeometry(1,ratio,32,16),write=rigidCoverWriter(geometry,ratio,dir);
  for(const progress of [0,.001,.08,.25,.5,.75,.92,.999,1]){
   write(progress,geometry);geometry.computeVertexNormals();const p=geometry.getAttribute("position"),angle=Math.PI*progress;
   for(let i=0;i<p.count;i++)assert.ok(Math.abs(dir*Math.sin(angle)*p.getX(i)-Math.cos(angle)*(p.getZ(i)-COVER_HEIGHT))<2e-7,"all vertices remain on one plane");
   const width=Math.hypot(p.getX(32)-p.getX(0),p.getZ(32)-p.getZ(0));
   assert.ok(Math.abs(width-(1+2*COVER_OVERHANG))<2e-7);assert.ok(Math.abs(p.getY(0)-p.getY(16*33)-(ratio+2*COVER_OVERHANG))<2e-7);
   if(progress>=.08&&progress<=.92)for(let i=0;i<p.count;i++)assert.ok(p.getZ(i)>=COVER_HEIGHT-1e-7);
  }
  geometry.dispose();
 }
});
test("closed hardback board meets the enlarged PDF artwork and has a lit spine material",()=>{
 const root=new THREE.Group(),binding=createBookBinding(root,1.4);binding.set("hardback",true);binding.sync([false,true],[false,true]);
 const group=root.children[0]!,board=(group.children[1]!.children[0] as THREE.Mesh);
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(board);
 assert.ok(Math.abs(bounds.max.z-COVER_HEIGHT)<1e-8);assert.ok(Math.abs(bounds.max.x-(1+2*COVER_OVERHANG))<1e-8);
 const spine=(group.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial;
 assert.ok(spine.envMapIntensity>=1);assert.equal(spine.emissive.getHex(),0);binding.dispose();
});
