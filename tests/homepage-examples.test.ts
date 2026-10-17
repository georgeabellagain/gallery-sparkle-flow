import {test} from "node:test";
import assert from "node:assert/strict";
import {HOME_EXAMPLE_CODES,chooseHomeExample} from "../src/lib/portfolia/homepage-examples";
test("homepage consistently shows only the owner-selected lookbook",()=>{assert.deepEqual(HOME_EXAMPLE_CODES,["adu2v"]);for(let i=0;i<20;i++)assert.equal(chooseHomeExample(),"adu2v");});
