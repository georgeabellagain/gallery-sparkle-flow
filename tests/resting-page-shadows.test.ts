import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createRestingPageShadows} from "../src/lib/portfolia/resting-page-shadows";

test("resting page shadow casters stay stable when anti-clipping hides visible pages",()=>{
 const book=new THREE.Group(),left=new THREE.Mesh(new THREE.PlaneGeometry()),right=new THREE.Mesh(new THREE.PlaneGeometry());
 left.position.x=-.5;right.position.x=.5;book.add(left,right);
 const shadows=createRestingPageShadows(book,[left,right]);
 const casters=book.children.slice(2) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[];
 shadows.sync([true,true]);left.visible=false;right.visible=false;
 assert.equal(left.castShadow,false);assert.equal(right.castShadow,false);
 assert.ok(casters.every(mesh=>mesh.visible&&mesh.castShadow));
 assert.equal(casters[0]!.geometry,left.geometry);assert.equal(casters[1]!.geometry,right.geometry);
 assert.equal(casters[0]!.position.x,-.5);assert.equal(casters[1]!.position.x,.5);
 assert.ok(casters.every(mesh=>!mesh.material.colorWrite&&!mesh.material.depthWrite));
 shadows.sync([false,true]);assert.equal(casters[0]!.visible,false);assert.equal(casters[1]!.visible,true);
 let disposed=0;left.geometry.addEventListener("dispose",()=>disposed++);
 shadows.dispose();assert.equal(book.children.length,2);assert.equal(disposed,0,"shared page geometry remains owned by the scene");
 left.geometry.dispose();right.geometry.dispose();
});
