import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {applyTurnPose,bakeTurnGeometry,createTurnGeometryCache,turnGeometryWriter} from "../src/lib/portfolia/turn-geometry-cache";
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
