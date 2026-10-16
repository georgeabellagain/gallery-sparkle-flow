import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HDRI_PRESETS,presetShadow } from '../src/lib/portfolia/lighting';
import { dappleTexture } from '../src/lib/portfolia/dapple-light';
test('all fifteen presets cast shadows in distinct directions within the shadow camera range',()=>{
 const directions=new Set<string>();
 for(const preset of HDRI_PRESETS){const profile=presetShadow(preset.id);const [x,y,z]=profile.position;directions.add(`${(x/z).toFixed(3)}:${(y/z).toFixed(3)}`);assert.ok(Math.hypot(x,y,z)<12);assert.ok(z>0);assert.ok(profile.radius>0);assert.ok(profile.penumbra>0&&profile.penumbra<1);}
 assert.equal(directions.size,15);
});
test('presets sharing a window mask prepare different projected patterns',()=>{
 const original=globalThis.document;let calls:unknown[]=[];
 const context={fillRect(...v:number[]){calls.push(['rect',...v]);},translate(...v:number[]){calls.push(['translate',...v]);},rotate(v:number){calls.push(['rotate',v]);},scale(...v:number[]){calls.push(['scale',...v]);}};
 globalThis.document={createElement(){return {width:256,height:256,getContext(){return context;}};}} as unknown as Document;
 try {
  const a=dappleTexture('window',presetShadow('8'));const first=JSON.stringify(calls);calls=[];
  const b=dappleTexture('window',presetShadow('9'));assert.notEqual(JSON.stringify(calls),first);
  assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='rotate'));a.dispose();b.dispose();
 }finally{globalThis.document=original;}
});
