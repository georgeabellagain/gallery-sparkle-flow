import assert from 'node:assert/strict';
import test from 'node:test';
import {totalAnalytics,portfolioAnalytics,allAnalyticsEvents} from '../src/lib/portfolia/analytics';
import type {Doc,Portfolio} from '../src/lib/portfolia/store';
const a={code:'a'} as Portfolio,b={code:'b'} as Portfolio;
const aa={visits:[{t:1,v:'same'},{t:2,v:'other'}],downloads:[1]};
const bb={visits:[{t:3,v:'same'}],downloads:[2,3]};
const doc:Doc={v:1,account:{signedIn:true},portfolio:a,analytics:aa,others:[{portfolio:b,analytics:bb}]};
test('dashboard totals include every portfolio while individual views remain separate',()=>{
 const totals=totalAnalytics(doc);assert.equal(totals.visits.length,3);assert.equal(totals.downloads.length,3);assert.equal(new Set(totals.visits.map(v=>v.v)).size,2);
 assert.deepEqual(portfolioAnalytics(doc,'a'),aa);assert.deepEqual(portfolioAnalytics(doc,'b'),bb);assert.deepEqual(portfolioAnalytics(doc,'not-owned'),{visits:[],downloads:[]});
 assert.deepEqual(totalAnalytics({...doc,portfolio:b,analytics:bb,others:[{portfolio:a,analytics:aa}]}).visits.slice().sort((a,b)=>a.t-b.t),totals.visits);
});
test('totals handle a parked active portfolio and do not double-count duplicate codes',()=>{
 assert.deepEqual(totalAnalytics({...doc,portfolio:null,analytics:{visits:[],downloads:[]}}),bb);
 assert.deepEqual(totalAnalytics({...doc,others:[...doc.others,{portfolio:a,analytics:aa}]}),totalAnalytics(doc));
});
test('analytics pagination includes records beyond the API batch limit',async()=>{
 const rows=Array.from({length:2003},(_,i)=>({portfolio_code:'a',kind:'visit',visitor:`v${i}`,created_at:'2026-10-06T00:00:00Z'}));const calls:number[][]=[];
 const got=await allAnalyticsEvents(async(from,to)=>{calls.push([from,to]);return {data:rows.slice(from,to+1),error:null};});assert.equal(got.length,2003);assert.deepEqual(calls,[[0,999],[1000,1999],[2000,2999]]);
});
test('failed batches do not present partial data as an all-time total',async()=>{
 await assert.rejects(()=>allAnalyticsEvents(async()=>({data:null,error:new Error('network')})),/Could not load visit statistics/);
 assert.deepEqual(await allAnalyticsEvents(async()=>({data:[],error:null})),[]);
});
