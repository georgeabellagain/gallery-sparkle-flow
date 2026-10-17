import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { rigidCoverWriter,coverLeaf,coverArtZ,coverTurnPose,COVER_GAP,COVER_HEIGHT,COVER_OVERHANG,OPEN_COVER_Z,PAGE_TOP } from "../src/lib/portfolia/rigid-cover";
import { createBookBinding } from "../src/lib/portfolia/book-binding";
import { pageRelief } from "../src/lib/portfolia/page-relief";

test("front and back boards include their reverse printed faces only",()=>{
 for(let i=0;i<14;i++)assert.equal(coverLeaf(i,14),[0,1,12,13].includes(i));
});
test("hardback covers rotate as enlarged planes without any bend in either direction",()=>{
 for(const dir of [1,-1] as const)for(const ratio of [.7,1.4,2]){
  const geometry=new THREE.PlaneGeometry(1,ratio,32,16),write=rigidCoverWriter(geometry,ratio,dir);
  for(const progress of [0,.001,.08,.25,.5,.75,.92,.999,1]){
   write(progress,geometry);geometry.computeVertexNormals();const p=geometry.getAttribute("position"),angle=Math.PI*progress,hinge=coverTurnPose(progress,COVER_HEIGHT,COVER_HEIGHT).z;
   for(let i=0;i<p.count;i++)assert.ok(Math.abs(dir*Math.sin(angle)*p.getX(i)-Math.cos(angle)*(p.getZ(i)-hinge))<2e-7,"all vertices remain on one plane");
   const width=Math.hypot(p.getX(32)-p.getX(0),p.getZ(32)-p.getZ(0));
   assert.ok(Math.abs(width-(1+2*COVER_OVERHANG))<2e-7);assert.ok(Math.abs(p.getY(0)-p.getY(16*33)-(ratio+2*COVER_OVERHANG))<2e-7);
   if(progress>=.08&&progress<=.92)for(let i=0;i<p.count;i++)assert.ok(p.getZ(i)>=hinge-1e-7);
  }
  geometry.dispose();
 }
});
test("an open cover lies below every resting page, so turned pages always land on top of it",()=>{
 let lowest=Infinity;
 for(let seed=0;seed<40;seed++)for(let d=0;d<=1;d+=.05)for(let v=0;v<=1;v+=.1)lowest=Math.min(lowest,pageRelief(d,v,seed));
 assert.ok(OPEN_COVER_Z<lowest,"open cover art is below the lowest paper");
 assert.equal(coverArtZ("open",.014),OPEN_COVER_Z);
 assert.ok(Math.abs(coverArtZ("closed",.014)-(PAGE_TOP+.014+COVER_GAP))<1e-12,"a closed cover sits on its board above the block");
});
test("turn pose starts and ends exactly at the resting heights, with no lift at rest",()=>{
 const closed=coverArtZ("closed",.014),open=coverArtZ("open",.014);
 assert.equal(coverTurnPose(0,closed,open).z,closed);assert.equal(coverTurnPose(1,closed,open).z,open);
 assert.equal(coverTurnPose(0,closed,open).angle,0);assert.equal(coverTurnPose(1,closed,open).angle,Math.PI);
 assert.ok(coverTurnPose(.04,closed,open).z>closed,"the board lifts off the hinge as it starts");
});
test("closed hardback board meets the enlarged PDF artwork and has a lit spine material",()=>{
 const root=new THREE.Group(),binding=createBookBinding(root,1.4);binding.set("hardback",true);binding.sync([false,true],[{kind:"page",share:1},{kind:"closed",share:1}]);
 const group=root.children[0]!,top=(group.children[1]!.children[2] as THREE.Mesh);
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(top);
 assert.ok(top.visible);
 assert.ok(Math.abs(bounds.max.z-(coverArtZ("closed",.014)-COVER_GAP))<1e-8);assert.ok(Math.abs(bounds.max.x-(1+2*COVER_OVERHANG))<1e-8);
 const spine=(group.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial;
 assert.ok(spine.envMapIntensity>=1);assert.equal(spine.emissive.getHex(),0);binding.dispose();
});
test("the turning board hands over seamlessly to the resting boards at both ends",()=>{
 const root=new THREE.Group(),binding=createBookBinding(root,1.4);binding.set("hardback",true);
 const front=new THREE.MeshStandardMaterial(),back=new THREE.MeshStandardMaterial();
 const shell=root.children[0]!,turning=shell.children[3] as THREE.Group,board=turning.children[0] as THREE.Mesh;
 const box=(object:THREE.Object3D)=>{root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(object);};
 // Opening the front cover: closed on the right, then open on the left.
 binding.turnCover(0,1,"closed","open",front,back);const start=box(board);
 binding.sync([false,true],[{kind:"page",share:1},{kind:"closed",share:1}]);const closedBoard=box(shell.children[1]!.children[2]!);
 assert.ok(Math.abs(start.max.z-closedBoard.max.z)<1e-6&&Math.abs(start.max.x-closedBoard.max.x)<1e-6,"starts where the closed front board rests");
 binding.turnCover(1,1,"closed","open",front,back);const end=box(board);
 binding.sync([true,true],[{kind:"open",share:1},{kind:"page",share:1}]);const openBoard=box(shell.children[0]!.children[0]!);
 assert.ok(Math.abs(end.max.z-openBoard.max.z)<1e-6&&Math.abs(end.min.x-openBoard.min.x)<1e-6,"lands where the open board rests");
 binding.turnCover(null,1,"open","open");assert.equal(turning.visible,false);
 binding.dispose();front.dispose();back.dispose();
});
