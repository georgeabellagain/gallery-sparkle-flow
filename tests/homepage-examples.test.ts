import {test} from "node:test";
import assert from "node:assert/strict";
import {HOME_EXAMPLE_CODES,HOME_EXAMPLE_START_PAGE,LOOKBOOK_CODE,chooseHomeExample} from "../src/lib/portfolia/homepage-examples";
import {fieldNotesExample} from "../src/lib/portfolia/field-notes-example";
import {readablePageJumps,readablePageLinks,readablePageSpotlights,readablePageTags,readablePageVideos} from "../src/lib/portfolia/page-extras";
import {readableFoldouts} from "../src/lib/portfolia/foldouts";
test("homepage consistently shows the published lookbook, opened on pages 4-5",()=>{assert.deepEqual(HOME_EXAMPLE_CODES,[LOOKBOOK_CODE]);assert.equal(LOOKBOOK_CODE,"adu2v");assert.equal(HOME_EXAMPLE_START_PAGE,4);for(let i=0;i<20;i++)assert.equal(chooseHomeExample(),LOOKBOOK_CODE);});
test("every feature on the Field Notes example is valid and has its file",()=>{
  const {portfolio,urls}=fieldNotesExample(),pdf=portfolio.pdf!;
  assert.equal(readablePageTags(pdf.tags,pdf.pages).length,5);
  assert.equal(readablePageSpotlights(pdf.spotlights,pdf.pages).length,3);
  assert.equal(readableFoldouts(pdf.foldouts,pdf.pages).length,2);
  assert.equal(readablePageLinks(pdf.links,pdf.pages).length,3);
  assert.equal(readablePageJumps(pdf.jumps,pdf.pages).length,11,"every contents row links to its article");
  const videos=readablePageVideos(pdf.videos,pdf.pages);
  assert.equal(videos.length,1);
  for(const key of [pdf.blobKey,videos[0]!.blobKey,videos[0]!.posterKey])assert.match(urls[key]??"",/^\/examples\/field-notes\//);
});
