import test from "node:test";
import assert from "node:assert/strict";
import {createHomeLookCycle, HOME_LOOK_INTERVAL_MS, type HomeDemoLook} from "../src/lib/portfolia/home-look-cycle";
function setup(){
 let now=0,id=0;const jobs=new Map<number,{at:number;run:()=>void}>(),seen:HomeDemoLook[]=[];
 const cycle=createHomeLookCycle(look=>seen.push(look),(run,delay)=>{const key=++id;jobs.set(key,{at:now+delay,run});return()=>{jobs.delete(key);};});
 const tick=(ms:number)=>{const end=now+ms;for(;;){const due=[...jobs].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;jobs.delete(due[0]);due[1].run();}now=end;};
 return {cycle,seen,tick,jobs};
}
test("Simple remains independent until Studio is ready, then the first switch is to Studio",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setActive(true);tick(60000);assert.deepEqual(seen,[]);assert.equal(jobs.size,0);
 cycle.setReady(true);assert.deepEqual(seen,["studio"]);tick(HOME_LOOK_INTERVAL_MS-1);assert.deepEqual(seen,["studio"]);tick(1);assert.deepEqual(seen,["studio","simple"]);tick(10000);assert.deepEqual(seen,["studio","simple","studio"]);cycle.pause();assert.equal(jobs.size,0);
});
test("offscreen/hidden pauses do not catch up or run duplicate timers",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setReady(true);tick(30000);assert.deepEqual(seen,[]);cycle.setActive(true);cycle.setReady(true);cycle.setActive(true);assert.equal(jobs.size,1);
 tick(3000);cycle.setActive(false);tick(60000);assert.deepEqual(seen,["studio"]);cycle.setActive(true);tick(9999);assert.deepEqual(seen,["studio"]);tick(1);assert.deepEqual(seen,["studio","simple"]);cycle.pause();
});
test("reader interaction freezes the current look; Studio failure safely returns to Simple",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setActive(true);cycle.setReady(true);cycle.pause();tick(30000);assert.deepEqual(seen,["studio"]);assert.equal(jobs.size,0);
 cycle.setReady(false);assert.deepEqual(seen,["studio","simple"]);tick(60000);assert.equal(jobs.size,0);
 cycle.setActive(true);tick(60000);assert.equal(jobs.size,0);cycle.setReady(true);assert.deepEqual(seen,["studio","simple","studio"]);cycle.pause();
});
