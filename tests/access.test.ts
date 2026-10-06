import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, grantToken, validGrant } from "../src/lib/portfolia/access-crypto.server";
import { accessState } from "../src/lib/portfolia/access.server";
import { servePortfolioFile } from "../src/lib/portfolia/file.server";

test("password hashes are salted and reject incorrect passwords", async () => {
  const one = await hashPassword("a long portfolio password"), two = await hashPassword("a long portfolio password");
  assert.notEqual(one, two);
  assert.equal(await verifyPassword("a long portfolio password", one), true);
  assert.equal(await verifyPassword("wrong password", one), false);
});
test("grants bind to code, secret and expiry; rotation revokes old grants", () => {
  const now=Date.now(), token=grantToken("book", "secret", now+60000);
  assert.equal(validGrant("book","secret",token,now),true);
  assert.equal(validGrant("other","secret",token,now),false);
  assert.equal(validGrant("book","rotated",token,now),false);
  assert.equal(validGrant("book","secret",token,now+60001),false);
  assert.equal(validGrant("book","secret",token.replace(/.$/,"x"),now),false);
});
test("expiry overrides valid password sessions and malformed expiry fails closed", () => {
  const now=Date.now(); const policy={code:"book",secret:"secret",password_hash:"hash",expires_at:null as string|null};
  assert.equal(accessState(null),"open");
  assert.equal(accessState(policy),"locked");
  const token=grantToken("book","secret",now+60000);
  assert.equal(accessState(policy,token,now),"open");
  policy.expires_at=new Date(now-1).toISOString(); assert.equal(accessState(policy,token,now),"expired");
  policy.expires_at="invalid"; assert.equal(accessState(policy,token,now),"expired");
});
test("protected file endpoint checks access and referenced asset before storage", async () => {
  let downloaded="";
  const row={owner_id:"owner",data:{plan:"free",pdf:{blobKey:"pdf_example"},profile:{}}};
  const db={from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})})}), storage:{from:()=>({download:async(path:string)=>{downloaded=path;return {data:new Blob(["pdf"],{type:"application/pdf"}),error:null};}})}};
  const locked=async()=>({policy:null,state:"locked" as const});
  const open=async()=>({policy:null,state:"open" as const});
  const url="https://portfolia.site/api/public/portfolio-file/book?asset=pdf_example";
  assert.equal((await servePortfolioFile("book",url,db,locked)).status,404);assert.equal(downloaded,"");
  assert.equal((await servePortfolioFile("book",url.replace("pdf_example","private_cv"),db,open)).status,404);assert.equal(downloaded,"");
  assert.equal((await servePortfolioFile("book",url.replace("pdf_example","../other-owner/file"),db,open)).status,404);
  const response=await servePortfolioFile("book",url,db,open);assert.equal(response.status,200);assert.equal(downloaded,"owner/pdf_example");assert.equal(response.headers.get("cache-control"),"private, no-store");
});
