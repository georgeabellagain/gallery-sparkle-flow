import test from "node:test";
import assert from "node:assert/strict";
import {createHomeLookCycle, type HomeDemoLook} from "../src/lib/portfolia/home-look-cycle";
function setup(){
 let now=0,id=0;const jobs=new Map<number,{at:number;run:()=>void}>(),seen:HomeDemoLook[]=[];
 const cycle=createHomeLookCycle(look=>seen.push(look),(run,delay)=>{const key=++id;jobs.set(key,{at:now+delay,run});return()=>{jobs.delete(key);};},()=>now);
 const tick=(ms:number)=>{const end=now+ms;for(;;){const due=[...jobs].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;jobs.delete(due[0]);due[1].run();}now=end;};
 return {cycle,seen,tick,jobs};
}
test("loading time never consumes the first 20-second Simple showing; later looks get 10 seconds",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setActive(true);cycle.setReady(true);tick(60000);assert.equal(jobs.size,0);assert.deepEqual(seen,[]);
 cycle.setPresented(true);tick(19999);assert.deepEqual(seen,[]);tick(1);assert.deepEqual(seen,["studio"]);
 tick(9999);assert.deepEqual(seen,["studio"]);tick(1);assert.deepEqual(seen,["studio","simple"]);tick(10000);assert.deepEqual(seen,["studio","simple","studio"]);cycle.pause();assert.equal(jobs.size,0);
});
test("an early Studio load does not restart the first dwell or skip it",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setPresented(true);cycle.setActive(true);tick(7000);cycle.setReady(true);assert.equal(jobs.size,1);tick(12999);assert.deepEqual(seen,[]);tick(1);assert.deepEqual(seen,["studio"]);cycle.pause();
});
test("Studio arriving after the first 20 seconds switches only when ready",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setPresented(true);cycle.setActive(true);tick(30000);assert.deepEqual(seen,[]);assert.equal(jobs.size,0);cycle.setReady(true);assert.deepEqual(seen,["studio"]);tick(10000);assert.deepEqual(seen,["studio","simple"]);cycle.pause();
});
test("hidden time does not count toward Simple's first showing or queue catch-up switches",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setReady(true);cycle.setPresented(true);cycle.setActive(true);tick(7000);cycle.setActive(false);tick(60000);cycle.setActive(true);cycle.setActive(true);assert.equal(jobs.size,1);tick(12999);assert.deepEqual(seen,[]);tick(1);assert.deepEqual(seen,["studio"]);cycle.pause();
});
test("reader interaction freezes the current look; Studio failure returns to Simple",()=>{
 const {cycle,seen,tick,jobs}=setup();cycle.setPresented(true);cycle.setActive(true);cycle.setReady(true);tick(20000);cycle.pause();tick(30000);assert.deepEqual(seen,["studio"]);assert.equal(jobs.size,0);cycle.setReady(false);assert.deepEqual(seen,["studio","simple"]);tick(60000);assert.equal(jobs.size,0);
});
test("retrying Simple resets the full initial showing",()=>{
 const {cycle,seen,tick}=setup();cycle.setPresented(true);cycle.setActive(true);cycle.setReady(true);tick(9000);cycle.setPresented(false);tick(60000);assert.deepEqual(seen,[]);cycle.setPresented(true);tick(19999);assert.deepEqual(seen,[]);tick(1);assert.deepEqual(seen,["studio"]);cycle.pause();
});
