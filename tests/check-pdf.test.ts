import test from "node:test";
import assert from "node:assert/strict";
import { inspectPdf } from "../src/lib/portfolia/check-pdf";
test("checker counts external link annotations, identifies mixed sizes and ignores script actions", async()=>{
 const doc={numPages:2,getPage:async(n:number)=>({getViewport:()=>({width:n===1?600:800,height:400}),getAnnotations:async()=>[{subtype:"Link",url:"https://example.com"},{subtype:"Link",url:"mailto:test@example.com"},{subtype:"Link",url:"javascript:alert(1)"},{subtype:"Text",url:"https://example.com"}]})};
 const r=await inspectPdf(doc,1000);assert.equal(r.links,4);assert.equal(r.variedSizes,true);assert.equal(r.landscape,true);assert.equal(r.pages,2);
});
test("checker bounds page analysis and reports partial checks",async()=>{
 let calls=0;const doc={numPages:500,getPage:async()=>{calls++;return {getViewport:()=>({width:400,height:600}),getAnnotations:async()=>[]};}};
 const r=await inspectPdf(doc,1000);assert.equal(calls,300);assert.equal(r.inspected,300);assert.equal(r.pages,500);
});
