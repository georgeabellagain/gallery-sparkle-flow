import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { bakeBrightnessMask, coneBrightness, createCachedLightMask } from "../src/lib/portfolia/cached-light-mask";

const angle = Math.PI/5, penumbra = .35;
test("cached cone matches Three spotlight smoothstep in light-projection coordinates", () => {
  for (let y=0; y<=40; y++) for (let x=0; x<=40; x++) {
    const u=x/40, v=y/40;
    const direction = new THREE.Vector3((2*u-1)*Math.tan(angle),(2*v-1)*Math.tan(angle),1).normalize();
    const expected = THREE.MathUtils.smoothstep(direction.z,Math.cos(angle),Math.cos(angle*(1-penumbra)));
    assert.ok(Math.abs(coneBrightness(u,v,angle,penumbra)-expected)<1e-12);
  }
});
test("bake preserves linear colour and warm tint instead of multiplying sRGB bytes", () => {
  const data = bakeBrightnessMask(new Uint8ClampedArray([255,244,219,255]),1,1,angle,penumbra);
  const colour = new THREE.Color().setRGB(1,244/255,219/255,THREE.SRGBColorSpace);
  [colour.r,colour.g,colour.b].forEach((expected,c)=>assert.ok(Math.abs(THREE.DataUtils.fromHalfFloat(data[c]!)-expected)<.001));
});
test("filtered mask follows analytic cone without visible edge steps", () => {
  const size=256, pixels=new Uint8ClampedArray(size*size*4).fill(255);
  const data=bakeBrightnessMask(pixels,size,size,angle,penumbra);
  const sample=(u:number,v:number)=>{
    const x=u*size-.5,y=v*size-.5,x0=Math.floor(x),y0=Math.floor(y),tx=x-x0,ty=y-y0;
    const value=(px:number,py:number)=>THREE.DataUtils.fromHalfFloat(data[(Math.max(0,Math.min(size-1,py))*size+Math.max(0,Math.min(size-1,px)))*4]!);
    return value(x0,y0)*(1-tx)*(1-ty)+value(x0+1,y0)*tx*(1-ty)+value(x0,y0+1)*(1-tx)*ty+value(x0+1,y0+1)*tx*ty;
  };
  for(let y=1;y<100;y++)for(let x=1;x<100;x++)assert.ok(Math.abs(sample(x/100,y/100)-coneBrightness(x/100,y/100,angle,penumbra))<.002);
});
test("shader chains paper hooks, retains Three dynamic shadow and physical material equations", () => {
  const mask=createCachedLightMask(true), material=new THREE.MeshStandardMaterial();
  let previous=false;
  material.onBeforeCompile=()=>{previous=true;};
  mask.apply(material);mask.apply(material);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
  assert.equal(previous,true);
  assert.ok(shader.fragmentShader.includes("uniform sampler2D cachedLightMask;"));
  assert.ok(shader.fragmentShader.includes("texture2D(cachedLightMask,spotLightCoord.xy)"));
  assert.ok(shader.fragmentShader.includes("if (!inSpotLightMap) getSpotLightInfo"));
  assert.ok(shader.fragmentShader.includes("getShadow( spotShadowMap[ i ]"));
  assert.ok(shader.fragmentShader.includes("RE_Direct( directLight"));
  assert.equal(shader.vertexShader,THREE.ShaderLib.standard.vertexShader);
  mask.dispose();material.dispose();
});
test("trial off keeps original shader; renderer-owned mask textures dispose independently", () => {
  const off=createCachedLightMask(false), material=new THREE.MeshStandardMaterial();
  const original=material.onBeforeCompile;off.apply(material);assert.equal(original,material.onBeforeCompile);off.dispose();
  const source=new THREE.CanvasTexture({width:1,height:1,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray([255,244,219,255])})})} as never);
  const first=createCachedLightMask(true), second=createCachedLightMask(true);
  const bind=(mask:ReturnType<typeof createCachedLightMask>)=>{
    const m=new THREE.MeshStandardMaterial();mask.apply(m);mask.set("test-shared",source,angle,penumbra);
    const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:"",fragmentShader:"#include <lights_fragment_begin>"};
    m.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);m.dispose();return shader.uniforms;
  };
  const a=bind(first), b=bind(second), ta=a.cachedLightMask!.value as THREE.DataTexture, tb=b.cachedLightMask!.value as THREE.DataTexture;
  assert.notEqual(ta,tb);assert.equal(ta.image.data,tb.image.data);
  let disposedA=0,disposedB=0;ta.addEventListener("dispose",()=>disposedA++);tb.addEventListener("dispose",()=>disposedB++);
  first.dispose();assert.equal(disposedA,1);assert.equal(disposedB,0);
  second.set("test-shared",null,angle,penumbra);assert.equal(b.cachedLightMaskEnabled!.value,false);
  second.dispose();assert.equal(disposedB,1);source.dispose();material.dispose();
});
