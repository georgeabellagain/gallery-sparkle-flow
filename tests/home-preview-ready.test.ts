import test from "node:test";
import assert from "node:assert/strict";
import {prepareVisiblePreview} from "../src/lib/portfolia/demo-readiness";
test("the preview reveal waits for its painted scene and a presentation frame",async()=>{
 const events:string[]=[];let draw!:()=>void,frame!:()=>void;
 const drawn=new Promise<void>(resolve=>{draw=resolve;}),shown=new Promise<void>(resolve=>{frame=resolve;});
 const pending=prepareVisiblePreview(()=>drawn,()=>{events.push("frame requested");return shown;}).then(()=>events.push("revealed"));
 await Promise.resolve();assert.deepEqual(events,[]);draw();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,["frame requested"]);frame();await pending;assert.deepEqual(events,["frame requested","revealed"]);
});
