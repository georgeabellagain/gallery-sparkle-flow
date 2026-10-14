import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {setNaturalImperfections,createAirDust,naturalIntensity} from "../src/lib/portfolia/natural-imperfections";
test("saved imperfections settings cannot install a shader while the feature is hidden",()=>{
 const material=new THREE.MeshPhysicalMaterial({roughness:.97,clearcoat:0}),hook=material.onBeforeCompile,key=material.customProgramCacheKey();
 for(const setting of [true,1,.5,false,0]){setNaturalImperfections(material,setting);assert.equal(material.userData["naturalEnabled"],0);assert.equal(material.onBeforeCompile,hook);assert.equal(material.customProgramCacheKey(),key);}
 assert.equal(material.roughness,.97);assert.equal(naturalIntensity(.5),.5,"saved preferences are retained rather than rewritten");material.dispose();
});
test("hidden air dust allocates no scene particles",()=>{
 const scene=new THREE.Scene(),dust=createAirDust(scene);dust.setIntensity(1);assert.equal(scene.children.length,0);dust.dispose();assert.equal(scene.children.length,0);
});
