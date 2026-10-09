import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderQueue } from "../src/lib/portfolia/render-queue";

test("pages cannot overlap work on the shared lighting context", async () => {
  const queue = createRenderQueue();
  const events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = queue.enqueue(async () => { events.push("first starts"); await gate; events.push("first ends"); return 1; });
  const second = queue.enqueue(async () => { events.push("second starts"); return 2; });
  await Promise.resolve();
  assert.deepEqual(events, ["first starts"]);
  release();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, ["first starts", "first ends", "second starts"]);
});

test("a failed lighting page does not block following pages", async () => {
  const queue = createRenderQueue();
  await assert.rejects(queue.enqueue(async () => { throw new Error("HDR unavailable"); }), /HDR/);
  assert.equal(await queue.enqueue(async () => "readable"), "readable");
});

test("closing a reader prevents queued GPU work from starting", async () => {
  const queue = createRenderQueue();
  let ran = false;
  const pending = queue.enqueue(async () => { ran = true; });
  queue.close();
  await assert.rejects(pending, /Reader closed/);
  assert.equal(ran, false);
  await assert.rejects(queue.enqueue(async () => true), /Reader closed/);
});
