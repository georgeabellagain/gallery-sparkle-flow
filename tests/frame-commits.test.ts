import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrameCommits } from "../src/lib/portfolia/frame-commits";

type Job = { current: () => boolean; artwork: string };
test("loading finishes without exposing artwork before the lighting frame", () => {
  const frames = createFrameCommits<string, Job>();
  let visible = "lit previous page";
  frames.stage("reader", { current: () => true, artwork: "lit next page" });
  assert.equal(visible, "lit previous page");
  frames.flush((_, job) => { visible = job.artwork; });
  assert.equal(visible, "lit next page");
});
test("rapid navigation presents only the latest artwork and skips cancelled renders", () => {
  const frames = createFrameCommits<string, Job>();
  const shown: string[] = [];
  frames.stage("reader", { current: () => true, artwork: "page 2" });
  frames.stage("reader", { current: () => true, artwork: "page 3" });
  frames.stage("obsolete", { current: () => false, artwork: "cancelled" });
  frames.flush((_, job) => shown.push(job.artwork));
  assert.deepEqual(shown, ["page 3"]);
});
test("unmounted pages never commit and new work during presentation waits for the next frame", () => {
  const frames = createFrameCommits<string, Job>();
  const shown: string[] = [];
  frames.stage("removed", { current: () => true, artwork: "removed" });
  frames.remove("removed");
  frames.stage("first", { current: () => true, artwork: "first" });
  frames.flush((_, job) => {
    shown.push(job.artwork);
    frames.stage("second", { current: () => true, artwork: "second" });
  });
  assert.deepEqual(shown, ["first"]);
  frames.flush((_, job) => shown.push(job.artwork));
  assert.deepEqual(shown, ["first", "second"]);
});
