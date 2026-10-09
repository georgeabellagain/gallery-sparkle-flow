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

test("parallel page preparation is bounded and preserves queued order", async () => {
  const queue = createRenderQueue(2);
  const started: number[] = [];
  const release: (() => void)[] = [];
  let active = 0, peak = 0;
  const jobs = [0, 1, 2, 3].map(id => queue.enqueue(async () => {
    started.push(id); peak = Math.max(peak, ++active);
    await new Promise<void>(resolve => { release[id] = resolve; });
    active--; return id;
  }));
  await Promise.resolve();
  assert.deepEqual(started, [0, 1]);
  release[0]!(); await jobs[0];
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2]);
  release[1]!(); release[2]!();
  await new Promise(resolve => setImmediate(resolve));
  release[3]!();
  assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3]);
  assert.equal(peak, 2);
});
