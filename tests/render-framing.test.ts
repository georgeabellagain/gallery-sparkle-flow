import { test } from "node:test";
import assert from "node:assert/strict";
import { studioRenderDimensions } from "../src/lib/portfolia/render-framing";
test("capture follows window proportions without stretching and obeys the GPU/codec budget",()=>{
  for(const [w,h] of [[1920,1080],[1440,900],[390,844],[3440,1440],[1024,1024]]) {
    const size=studioRenderDimensions(w,h);
    assert.equal(size.width%2,0);assert.equal(size.height%2,0);
    assert.ok(size.width<=3840&&size.height<=3840);
    assert.ok(size.width*size.height<=8_294_400);
    assert.ok(Math.abs(size.width/size.height-w/h)<.003);
  }
  assert.deepEqual(studioRenderDimensions(1920,1080),{width:3840,height:2160});
});
