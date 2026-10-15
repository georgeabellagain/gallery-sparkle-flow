import {test} from "node:test";
import assert from "node:assert/strict";
import {HOME_EXAMPLE_CODES,chooseHomeExample} from "../src/lib/portfolia/homepage-examples";
test("homepage random selection uses only the two explicitly selected published examples",()=>{
 assert.deepEqual(HOME_EXAMPLE_CODES,["adu2v","pink28"]);
 for(const value of [0,.25,.4999])assert.equal(chooseHomeExample(()=>value),"adu2v");
 for(const value of [.5,.75,.9999])assert.equal(chooseHomeExample(()=>value),"pink28");
});
