import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { coverColourFromPixels } from "../src/lib/portfolia/cover-colour";
import { deepTurnCurl } from "../src/lib/portfolia/turn-curve";
import { shootCamera } from "../src/lib/portfolia/photo-shoot";
import { createBookBinding } from "../src/lib/portfolia/book-binding";

test("cover trim follows the dominant PDF perimeter instead of central artwork",()=>{
 const data=new Uint8ClampedArray(32*32*4);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++)data.set(x>4&&x<28&&y>4&&y<28?[250,30,30,255]:[25,87,120,255],(y*32+x)*4);
 assert.equal(coverColourFromPixels(data,32,32),"#195778");
 assert.equal(coverColourFromPixels(new Uint8ClampedArray(16),2,2),"#f4f1e9");
});
test("hardback cover matching survives lighting and book-style changes",()=>{
 const root=new THREE.Group(),binding=createBookBinding(root,1.4);
 binding.set("hardback",true);binding.setCoverColour("#195778");
 const board=(root.children[0]!.children[0]!.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
 assert.equal(board.color.getHexString(),"195778");
 binding.set("softcover",false);assert.equal(board.emissive.getHexString(),"195778");
 binding.set("hardback",true);assert.equal(board.color.getHexString(),"195778");binding.dispose();
});
test("deep curl is milder and changes profile as the sheet advances",()=>{
 const early=deepTurnCurl(.3,.5,.1),middle=deepTurnCurl(.3,.5,.5),late=deepTurnCurl(.3,.5,.9);
 assert.ok(middle>early);assert.ok(middle>late);assert.notEqual(early,late);
 for(let i=0;i<=100;i++)for(const v of [0,.5,1])assert.ok(deepTurnCurl(i/100,v,.5)<=.265+1e-9);
 assert.equal(deepTurnCurl(0,.5,.5),0);
});
test("photo camera stays in front of the wall and above the floor within bounded angles",()=>{
 for(const ratio of [.65,1.4,2])for(const aspect of [.5,.8,1.6])for(const yaw of [-90,-40,0,40,90])for(const elevation of [-20,2,25,80]){
  const pose=shootCamera(yaw,elevation,1,ratio,aspect);
  assert.ok(pose.position.z>0);assert.ok(pose.position.y>pose.target.y);
  assert.ok([pose.position.x,pose.position.y,pose.position.z].every(Number.isFinite));
 }
 const clamp=shootCamera(90,80,5,1.4,.8),bounded=shootCamera(40,25,1.4,1.4,.8);
 assert.ok(clamp.position.distanceTo(bounded.position)<1e-9);
});

test("photo lighting follows the selected editor HDRI and paper",async()=>{
 const {photoLighting,photoSpreadPages}=await import("../src/lib/portfolia/photo-settings");
 assert.deepEqual(photoLighting({studioLighting:"12",finish:"paper_0027",studioBrightness:1.2,studioLightingStrength:.35,studioTopLight:.4}),{hdri:"12",finish:"paper_0027",brightness:1.2,strength:.35,topLight:.4});
 assert.deepEqual(photoSpreadPages(1,14),[null,1]);assert.deepEqual(photoSpreadPages(2,14),[2,3]);assert.deepEqual(photoSpreadPages(3,14),[2,3]);assert.deepEqual(photoSpreadPages(14,14),[14,null]);
 assert.deepEqual(photoSpreadPages(500,13),[12,13]);
 const closed=shootCamera(20,10,1,1.4,.8),spread=shootCamera(20,10,1,1.4,.8,2.1);
 assert.ok(spread.position.distanceTo(spread.target)>closed.position.distanceTo(closed.target));
});
test("wall and floor presets provide colour, normal and roughness files",async()=>{
 const {BACKGROUND_PRESETS,backgroundSurfaceMaps}=await import("../src/lib/portfolia/background-presets");
 const {existsSync}=await import("node:fs");
 for(const preset of BACKGROUND_PRESETS){const maps=backgroundSurfaceMaps(preset.url)!;for(const file of [preset.url,maps.normal,maps.roughness])assert.ok(existsSync(`public${file}`),file);}
});
