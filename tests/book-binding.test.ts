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
  binding.set(style.id,true);binding.sync([false,true]);
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
