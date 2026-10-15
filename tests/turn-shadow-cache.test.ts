import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createTurnShadowCache, turnShadowKey} from "../src/lib/portfolia/turn-shadow-cache";

test("cached turns restore GPU targets and light matrices without overwriting cached frames",()=>{
  const light=new THREE.DirectionalLight(); light.castShadow=true;
  const cache=createTurnShadowCache([light],2);
  const first=new THREE.WebGLRenderTarget(2,2); light.shadow.map=first;
  light.shadow.matrix.makeTranslation(1,2,3); cache.save("first");
  assert.equal(cache.restore("missing"),false); assert.equal(light.shadow.map,null);
  const second=new THREE.WebGLRenderTarget(2,2); light.shadow.map=second; cache.save("second");
  light.shadow.matrix.identity();
  assert.equal(cache.restore("first"),true); assert.equal(light.shadow.map,first);
  assert.equal(light.shadow.matrix.elements[12],1);
  cache.detach(); assert.equal(light.shadow.map,null);
  cache.clear(); assert.equal(cache.restore("first"),false);
});

test("cache evicts old GPU targets and preserves the currently attached target",()=>{
  const light=new THREE.SpotLight(); light.castShadow=true;
  const cache=createTurnShadowCache([light],1); let disposed=0;
  const first=new THREE.WebGLRenderTarget(2,2); first.addEventListener("dispose",()=>disposed++);
  light.shadow.map=first; cache.save("a"); cache.restore("b");
  const second=new THREE.WebGLRenderTarget(2,2);light.shadow.map=second; cache.save("b");
  assert.equal(disposed,1);assert.equal(light.shadow.map,second);
  cache.clear();assert.equal(light.shadow.map,null);
});

test("turn shadow keys separate direction and page visibility but reuse nearby progress",()=>{
  assert.equal(turnShadowKey(.5,1,true,true),turnShadowKey(.501,1,true,true));
  assert.notEqual(turnShadowKey(.5,1,true,true),turnShadowKey(.5,-1,true,true));
  assert.notEqual(turnShadowKey(.5,1,true,true),turnShadowKey(.5,1,true,false));
});
