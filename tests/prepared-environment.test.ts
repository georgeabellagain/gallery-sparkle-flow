import { test } from "node:test";
import assert from "node:assert/strict";
import { createEnvironmentCache } from "../src/lib/portfolia/prepared-environment";

test("environment preparation shares concurrent work and evicts least recently used entries", async () => {
  const calls: string[] = [];
  const load = createEnvironmentCache(async id => { calls.push(id); return { id }; }, 2);
  const first = load("1");
  assert.equal(load("1"), first);
  await first; await load("2"); await load("1"); await load("3");
  assert.equal(await load("1"), await first);
  await load("2");
  assert.deepEqual(calls, ["1", "2", "3", "2"]);
});
test("failed lighting preparation can retry", async () => {
  let calls = 0;
  const load = createEnvironmentCache(async () => { if (++calls === 1) throw Error("offline"); return 42; });
  await assert.rejects(load("1"));
  assert.equal(await load("1"), 42);
});
