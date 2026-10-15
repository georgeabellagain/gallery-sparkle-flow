import {test} from "node:test";
import assert from "node:assert/strict";
import {releaseHomeScroll} from "../src/components/pf/home-scroll";
test("homepage wheel input moves down the page only at the fitted zoom limit",()=>{
 assert.equal(releaseHomeScroll(true,false,1,100),true);
 assert.equal(releaseHomeScroll(true,false,1.5,100),false);
 assert.equal(releaseHomeScroll(true,false,1,-100),false);
 assert.equal(releaseHomeScroll(true,true,1,100),false);
 assert.equal(releaseHomeScroll(false,false,1,100),false);
});
