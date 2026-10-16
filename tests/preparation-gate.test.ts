import test from "node:test";
import assert from "node:assert/strict";
import { createPreparationGate } from "../src/lib/portfolia/preparation-gate";
test("speculative render chunks wait during motion but demanded pages never deadlock", () => {
  const gate = createPreparationGate<number>(), calls: number[] = [];
  gate.setPaused(true);
  gate.schedule(1, () => calls.push(1)); gate.schedule(2, () => calls.push(2));
  assert.deepEqual(calls, []);
  const release = gate.prioritize(2);
  assert.deepEqual(calls, [2]);
  gate.schedule(2, () => calls.push(20)); assert.deepEqual(calls, [2,20]);
  release(); gate.schedule(2, () => calls.push(21)); assert.deepEqual(calls, [2,20]);
  gate.setPaused(false); assert.deepEqual(calls, [2,20,1,21]);
});
test("priority holds are counted and disposal releases pending composition waits", () => {
  const gate = createPreparationGate<number>(), calls: number[] = [];
  gate.setPaused(true); const first = gate.prioritize(1), second = gate.prioritize(1);
  first(); gate.schedule(1, () => calls.push(1)); assert.deepEqual(calls, [1]);
  second(); gate.schedule(1, () => calls.push(2)); gate.close(); assert.deepEqual(calls, [1,2]);
});
