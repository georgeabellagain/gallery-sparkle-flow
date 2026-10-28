import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BOOK_STYLES, bookStyleProfile, bindingTurnCurve } from "../src/lib/portfolia/book-style";
import { createBookBinding } from "../src/lib/portfolia/book-binding";
import { studioShadowSize, studioShadowRadius } from "../src/lib/portfolia/shadow-quality";

test("binding styles have distinct dimensions and safe legacy defaults",()=>{
 assert.equal(bookStyleProfile(undefined).id,"flipbook");assert.equal(bookStyleProfile("invalid").id,"flipbook");
 const soft=bookStyleProfile("softcover"),hard=bookStyleProfile("hardback");
 assert.ok(hard.board>soft.board*4);assert.ok(hard.stack>soft.stack);assert.ok(hard.overhang>soft.overhang);assert.ok(hard.spine>soft.spine);
 assert.equal(bindingTurnCurve("hardback","deep",[null,{}],[{},{}]),"firm");
 assert.equal(bindingTurnCurve("hardback","corner",[{},{}],[{},null]),"firm");
 assert.equal(bindingTurnCurve("hardback","deep",[{},{}],[{},{}]),"deep");
 // A card cover is stiffer than paper too; loose flipbook sheets keep the creator's curve.
 assert.equal(bindingTurnCurve("softcover","corner",[null,{}],[{},{}]),"firm");
 assert.equal(bindingTurnCurve("flipbook","corner",[null,{}],[{},{}]),"corner");
});
test("shell stays under artwork and above backdrop, follows spread visibility and disposes resources",()=>{
 const book=new THREE.Group(),binding=createBookBinding(book,1.4),shell=book.children[0] as THREE.Group;
 const disposed=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture>();
 for(const style of BOOK_STYLES){
  // One page of an open spread (part of the block on each side), as a narrow screen shows it.
  binding.set(style.id,true);binding.sync([false,true],[{kind:"page",share:.4},{kind:"page",share:.6}]);
  assert.equal(shell.visible,style.id!=="flipbook");assert.equal(shell.children[0]!.visible,false);assert.equal(shell.children[1]!.visible,true);
  if(style.id==="flipbook")continue;
  book.updateMatrixWorld(true);
  // Hidden parts (a closed book's top board, the turning board) are not drawn on an open spread.
  const box=new THREE.Box3();shell.traverseVisible(o=>{if(o instanceof THREE.Mesh&&o.name!=="Headband")box.expandByObject(o);});
  assert.ok(box.max.z<=-.0049,"shell cannot cover PDF artwork");assert.ok(box.min.z>-.072,"shell cannot intersect backdrop");
  // Headbands may sit at paper level, but only beyond the head and foot of the pages, never over the artwork.
  shell.traverseVisible(o=>{if(o.name==="Headband"){const band=new THREE.Box3().setFromObject(o);assert.ok(Math.min(Math.abs(band.min.y),Math.abs(band.max.y))>=1.4/2-.006,"headband stays outside the page area");assert.ok(band.max.z<.014,"headband stays under the paper's rise at the spine");}});
 }
 const resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture>();
 shell.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);resources.add(o.material);if(o.material.map)resources.add(o.material.map);}});
 resources.forEach(resource=>resource.addEventListener("dispose",()=>disposed.add(resource)));
 binding.dispose();assert.equal(book.children.length,0);assert.equal(disposed.size,resources.size);
});
test("a closed soft cover's spine reaches up to the cover paper, leaving no gap",()=>{
 const book=new THREE.Group(),binding=createBookBinding(book,1.4),shell=book.children[0] as THREE.Group;
 binding.set("softcover",true);binding.sync([false,true],[{kind:"page",share:0},{kind:"page",share:1}]);book.updateMatrixWorld(true);
 const spines=shell.children.filter(o=>o instanceof THREE.Mesh&&o.visible&&o.geometry instanceof THREE.ExtrudeGeometry);
 assert.equal(spines.length,1);
 const box=new THREE.Box3().setFromObject(spines[0]!);
 // The paper sits 0.014 above the table plane at the spine (pageRelief), just above the spine's top.
 assert.ok(box.max.z>.013&&box.max.z<.014,`spine top ${box.max.z}`);assert.ok(box.max.x>0&&box.min.x<-.004,"wraps the edge and tucks under the cover");
 binding.dispose();
});
test("repeated exposure changes reuse binding material programs",()=>{
 const book=new THREE.Group(),binding=createBookBinding(book,1.4);binding.set("hardback",false);
 const material=(book.children[0]!.children[0]!.children[1] as THREE.Mesh).material as THREE.Material;
 const version=material.version;binding.set("hardback",false);assert.equal(material.version,version);
 binding.set("hardback",true);assert.equal(material.version,version+1);binding.dispose();
});
test("shadow detail scales with output without reducing the preset's physical softness",()=>{
 assert.equal(studioShadowSize(600,700),1024);assert.equal(studioShadowSize(1920,1080),2048);
 assert.equal(studioShadowSize(900,700,2),2048);assert.equal(studioShadowSize(600,700,1,4096,true),2048);
 assert.equal(studioShadowSize(1920,1080,2,1024),1024);
 for(const radius of [1.5,3,7])for(const size of [512,1024,2048])assert.equal(studioShadowRadius(radius,size)/size,radius/512);
});

test("layered paper follows side shares, works for loose sheets and switches off cleanly",()=>{
 const book=new THREE.Group(),binding=createBookBinding(book,1.4),shell=book.children[0] as THREE.Group;
 binding.setLeaves(40);binding.set("flipbook",true,true);
 binding.sync([true,true],[{kind:"page",share:.2},{kind:"page",share:.8}]);
 assert.equal(shell.visible,true);
 const layers:THREE.InstancedMesh[]=[];
 shell.traverse(o=>{if(o instanceof THREE.InstancedMesh)layers.push(o);});
 assert.equal(layers.length,2);assert.equal(layers[0]!.count,4);assert.equal(layers[1]!.count,16);
 const m=new THREE.Matrix4();
 for(const layer of layers)for(let i=0;i<layer.count;i++){
  layer.getMatrixAt(i,m);const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);
  assert.ok(p.z+s.z/2<-.0049,"paper stays below the current spread");
 }
 binding.set("flipbook",true,false);binding.sync([true,true]);
 assert.equal(shell.visible,false);assert.ok(layers.every(l=>l.count===0));
 binding.dispose();assert.equal(book.children.length,0);
});

test("page 2 and the closing page have no offset layers or layer shadows",()=>{
 const book=new THREE.Group(),binding=createBookBinding(book,1.4),shell=book.children[0] as THREE.Group;
 binding.setLeaves(20);binding.set("hardback",true,true);
 binding.sync([true,true],[{kind:"page",share:.05,leaf:1},{kind:"page",share:.8,leaf:2}]);
 const sides=shell.children.slice(0,2) as THREE.Group[];
 const layers=sides.map(side=>side.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh);
 assert.equal(layers[0]!.count,0);assert.ok(layers[1]!.count>0);
 binding.sync([false,true],[{kind:"page",share:1,leaf:18},{kind:"closed",share:1,leaf:19}]);
 assert.equal(layers[1]!.count,0);assert.equal(layers[1]!.visible,false);
 binding.set("softcover",false,true);
 binding.sync([true,true],[{kind:"page",share:.5,leaf:8},{kind:"page",share:.5,leaf:9}]);
 const mat=layers[0]!.material as THREE.MeshStandardMaterial;
 assert.ok(mat.emissiveMap,"Simple preserves the subtle contact shade");
 binding.dispose();
});
