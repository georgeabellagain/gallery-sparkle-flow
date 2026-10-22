import {test} from "node:test";
import assert from "node:assert/strict";
import {HOME_EXAMPLE_CODES,chooseHomeExample} from "../src/lib/portfolia/homepage-examples";
import {FIELD_NOTES_CODE,fieldNotesExample} from "../src/lib/portfolia/field-notes-example";
import {readablePageJumps,readablePageLinks,readablePageSpotlights,readablePageTags,readablePageVideos} from "../src/lib/portfolia/page-extras";
import {readableFoldouts} from "../src/lib/portfolia/foldouts";
test("homepage consistently shows only the site's own Field Notes example",()=>{assert.deepEqual(HOME_EXAMPLE_CODES,[FIELD_NOTES_CODE]);for(let i=0;i<20;i++)assert.equal(chooseHomeExample(),FIELD_NOTES_CODE);});
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
