import test from "node:test";
import assert from "node:assert/strict";
import { prepareDemoPresentation } from "../src/lib/portfolia/demo-readiness";

test("Studio reveal waits for resources, painted shaders and a browser frame in order", async () => {
  const events: string[] = [];
  let finishResources: (() => void) | undefined;
  const resources = new Promise<void>(resolve => { finishResources = resolve; });
  let finishFrame: (() => void) | undefined;
  const frame = new Promise<void>(resolve => { finishFrame = resolve; });
  const ready = prepareDemoPresentation(
    () => resources,
    async () => { events.push("painted"); },
    () => { events.push("frame requested"); return frame; },
  ).then(() => events.push("revealed"));
  await Promise.resolve();
  assert.deepEqual(events, []);
  finishResources?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ["painted", "frame requested"]);
  finishFrame?.();
  await ready;
  assert.deepEqual(events, ["painted", "frame requested", "revealed"]);
});

test("failed Studio resources never reveal an unprepared frame", async () => {
  let painted = false, revealed = false;
  await assert.rejects(prepareDemoPresentation(
    async () => { throw new Error("lighting unavailable"); },
    async () => { painted = true; },
    async () => { revealed = true; },
  ), /lighting unavailable/);
  assert.equal(painted, false);
  assert.equal(revealed, false);
});