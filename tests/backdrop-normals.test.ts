import test from 'node:test';import assert from 'node:assert/strict';
import {backdropNormals} from '../src/lib/portfolia/backdrop-normals';
test('flat photographs produce neutral tangent-space normals',()=>{
 const source=new Uint8ClampedArray(8*8*4).fill(128);const result=backdropNormals(source,8,8);
 for(let i=0;i<result.length;i+=4) assert.deepEqual([...result.slice(i,i+4)],[128,128,255,255]);
});
test('fine photographic texture varies normals without changing source pixels',()=>{
 const source=new Uint8ClampedArray(8*8*4).fill(128);source[(4*8+4)*4]=255;const before=source.slice();const result=backdropNormals(source,8,8);
 assert.deepEqual(source,before);assert.ok(result.some((value,index)=>index%4<2 && value!==128));
});
