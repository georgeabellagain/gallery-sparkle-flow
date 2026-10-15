import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {applyTurnPose,bakeTurnGeometry,createTurnGeometryCache,turnGeometryWriter,restingTurnNormals} from "../src/lib/portfolia/turn-geometry-cache";
import {pageRelief} from "../src/lib/portfolia/page-relief";

test("baked page poses preserve exact endpoints, continuous positions and unit lighting normals",()=>{
 for(const dir of [1,-1] as const) {
  const geometry=new THREE.PlaneGeometry(1,1.4,32,16),direct=geometry.clone();
  const write=turnGeometryWriter(geometry,1.4,dir,[3,4],[4,3],.01);
  const poses=bakeTurnGeometry(geometry,write);
  for(const p of [0,.001,.075,.123,.499,.501,.777,.925,.999,1]){
   applyTurnPose(poses,p,geometry);write(p,direct);direct.computeVertexNormals();
   const a=geometry.getAttribute("position"),b=direct.getAttribute("position"),n=geometry.getAttribute("normal");
   for(let i=0;i<a.count;i++) {
    assert.ok(Math.abs(a.getX(i)-b.getX(i))<.0003);assert.ok(Math.abs(a.getZ(i)-b.getZ(i))<.0003);
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.00001);
    if(p===0||p===1) assert.equal(a.getZ(i),b.getZ(i),"resting page handoff is exact");
    if(p>.08&&p<.92) {
      const floor=pageRelief(Math.min(1,Math.abs(a.getX(i))),geometry.getAttribute("uv").getY(i),a.getX(i)<0?4:3);
      assert.ok(a.getZ(i)>floor+.0095,"interpolated sheet clears the page below");
    }
   }
  }
  geometry.dispose();direct.dispose();
 }
});

test("pose cache reuses geometry without rebaking and evicts older page combinations",()=>{
 const cache=createTurnGeometryCache(2);let calls=0;
 const bake=()=>{calls++;return [{positions:new Float32Array([calls]),normals:new Float32Array([1])}];};
 const a=cache.get("a",bake);assert.equal(cache.get("a",bake),a);assert.equal(calls,1);
 cache.get("b",bake);cache.get("a",bake);cache.get("c",bake);assert.equal(cache.get("a",bake),a);
 cache.get("b",bake);assert.equal(calls,4);cache.clear();cache.get("a",bake);assert.equal(calls,5);
});

test("closing sheets hand off to identical resting-page lighting normals in both directions",()=>{
 for(const dir of [1,-1] as const) {
  const geometry=new THREE.PlaneGeometry(1,1.4,32,16);
  const ends=[restingTurnNormals(geometry,1.4,dir,3,dir),restingTurnNormals(geometry,1.4,-dir as 1|-1,4,-dir)] as const;
  const poses=bakeTurnGeometry(geometry,turnGeometryWriter(geometry,1.4,dir,[3,4],[4,3],.01),128,ends);
  for(const end of [0,1] as const) {
   applyTurnPose(poses,end,geometry);
   const side=(end===0?dir:-dir) as 1|-1,sign=end===0?dir:-dir,seed=end===0?3:4;
   const resting=new THREE.PlaneGeometry(1,1.4,32,16),p=resting.getAttribute("position");
   for(let i=0;i<p.count;i++)p.setZ(i,pageRelief(.5+side*p.getX(i),p.getY(i)/1.4+.5,seed));
   resting.computeVertexNormals();const n=resting.getAttribute("normal"),moving=geometry.getAttribute("normal");
   for(let i=0;i<p.count;i++) {
    const index=side===1?i:Math.floor(i/33)*33+32-i%33;
    const current=new THREE.Vector3(moving.getX(i)*sign,moving.getY(i)*sign,moving.getZ(i)*sign);
    const still=new THREE.Vector3(n.getX(index),n.getY(index),n.getZ(index));
    assert.ok(current.distanceTo(still)<.000001,"sheet-to-page swap must not change lighting direction");
   }
   resting.dispose();
  }
  geometry.dispose();
 }
});
