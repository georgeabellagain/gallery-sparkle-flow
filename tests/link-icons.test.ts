import { test } from "node:test";
import assert from "node:assert/strict";
import { linkAppearance } from "../src/lib/portfolia/link-appearance";
import { loadLinkIcons, paintPageLinks, iconKeyOf } from "../src/lib/portfolia/link-paint";
import { validatePageLink, type PageLink } from "../src/lib/portfolia/page-extras";

const link: PageLink = { id:"web_1", page:1, half:"right", url:"https://example.com/work", x:.2, y:.3, size:.1 };

test("legacy and custom logo defaults stay consistent with explicit appearance", () => {
  assert.deepEqual(linkAppearance(link), {radius:.22,fit:"contain",padding:.19,background:"#ffffff"});
  assert.equal(linkAppearance({...link,iconKey:"logo_1"}).fit,"cover");
  assert.deepEqual(linkAppearance({...link,iconShape:"circle",iconFit:"contain",iconPadding:10,iconBackground:"#112233"}), {radius:.5,fit:"contain",padding:.1,background:"#112233"});
  assert.equal(linkAppearance({...link,iconShape:"square"}).radius,0);
});

test("invalid logo options are rejected and existing links stay valid", () => {
  assert.equal(validatePageLink(link,2),null);
  assert.equal(validatePageLink({...link,iconShape:"circle",iconPadding:40,iconBackground:"#abcdef"},2),null);
  for(const patch of [{iconPadding:41},{iconPadding:NaN},{iconShape:"triangle"},{iconFit:"stretch"},{iconBackground:"red"}]) {
    assert.ok(validatePageLink({...link,...patch} as PageLink,2));
  }
});

test("a failed favicon can recover on the next draw rather than stay cached as missing", async () => {
  const originalFetch=globalThis.fetch, originalBitmap=globalThis.createImageBitmap;
  let requests=0;
  const bitmap={width:32,height:32,close(){}} as ImageBitmap;
  globalThis.fetch=async (_url, init) => {
    assert.ok(init?.signal);
    requests++;
    return requests===1 ? new Response(null,{status:404}) : new Response(new Blob(["png"],{type:"image/png"}));
  };
  globalThis.createImageBitmap=async ()=>bitmap;
  try {
    const cache=new Map<string,ImageBitmap|null>();
    await loadLinkIcons([link],cache);
    assert.equal(cache.get(iconKeyOf(link)),null);
    await loadLinkIcons([link],cache);
    assert.equal(cache.get(iconKeyOf(link)),bitmap);
    await loadLinkIcons([link],cache);
    assert.equal(requests,2,"successful bitmaps are reused");
  } finally { globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap; }
});

test("printed custom logos use the chosen background and padded crop", () => {
  const calls: Array<[string,...unknown[]]>=[];
  const ctx=new Proxy({},{
    get:(_target,key:string)=>key==="measureText"?()=>({width:0}):(...args:unknown[])=>calls.push([key,...args]),
    set:(_target,key:string,value)=>{calls.push([key,value]);return true;},
  }) as CanvasRenderingContext2D;
  const custom={...link,iconKey:"logo_1",iconShape:"square" as const,iconFit:"contain" as const,iconPadding:10,iconBackground:"#123456"};
  const bitmap={width:200,height:100} as ImageBitmap;
  paintPageLinks(ctx,1000,1400,[custom],new Map([[iconKeyOf(custom),bitmap]]));
  assert.ok(calls.some(([name,value])=>name==="fillStyle"&&value==="#123456"));
  assert.ok(calls.some(([name,...args])=>name==="rect"&&args.join(",")==="210,430,80,80"));
  assert.ok(calls.some(([name,...args])=>name==="drawImage"&&args.slice(-2).join(",")==="80,40"));
});
