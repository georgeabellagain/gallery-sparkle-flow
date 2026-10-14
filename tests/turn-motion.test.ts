import { test } from "node:test";
import assert from "node:assert/strict";
import { turnEase, turnClearance, turnSheetHeight, captureFrames, turnRestVisible, turnVideoTime } from "../src/lib/portfolia/turn-motion";

test("turns settle without a discontinuous shadow offset in either direction", () => {
  assert.equal(turnClearance(0, .01), 0);
  assert.ok(Math.abs(turnClearance(1, .01)) < 1e-12);
  assert.equal(turnClearance(.5, .01), .01);
  for (const t of [.01, .1, .25, .49]) assert.ok(Math.abs(turnClearance(t, .01) - turnClearance(1-t, .01)) < 1e-12);
});
test("turn timing has gentle endpoints and advances monotonically", () => {
  assert.equal(turnEase(0), 0); assert.equal(turnEase(1), 1);
  assert.ok(turnEase(.01) < .0001);
  assert.ok(1 - turnEase(.99) < .0001);
  for (let i = 1; i <= 100; i++) assert.ok(turnEase(i/100) >= turnEase((i-1)/100));
});

test("click turns stay above differently curved receiving pages at both ends", () => {
  for (const height of [-.003, 0, .003, .2]) for (const floor of [-.003, 0, .003]) {
    assert.ok(turnSheetHeight(height, floor, .01) >= floor + .01);
    assert.ok(turnSheetHeight(height, floor, .01) >= height);
  }
});

test('offline capture encodes every sample despite a slow encoder',async()=>{
  const samples:number[]=[];let frames=0;
  await captureFrames(1000,t=>samples.push(t),async()=>{await Promise.resolve();frames++;});
  assert.equal(frames,31);assert.equal(samples[0],0);assert.equal(samples.at(-1),1);
  samples.forEach((t,i)=>assert.equal(t,i/30));
});

test("turning geometry matches its resting surface exactly at both endpoints", () => {
  for (const height of [-.003, 0, .003, .04]) for (const floor of [-.003, 0, .08]) {
    assert.equal(turnSheetHeight(height, floor, .01, 0), height);
    assert.equal(turnSheetHeight(height, floor, .01, 1), height);
    assert.ok(Math.abs(turnSheetHeight(height, floor, .01, .00001) - height) < 1e-7);
    assert.ok(turnSheetHeight(height, floor, .01, .08) >= floor + .01);
    assert.ok(turnSheetHeight(height, floor, .01, .92) >= floor + .01 - 1e-12);
  }
});

test("resting pages avoid the first and last five percent in either travel direction", () => {
  for (const t of [0, .01, .049]) assert.equal(turnRestVisible(t, true), false);
  for (const t of [.05, .5, 1]) assert.equal(turnRestVisible(t, true), true);
  for (const t of [0, .5, .949]) assert.equal(turnRestVisible(t, false), true);
  for (const t of [.95, .99, 1]) assert.equal(turnRestVisible(t, false), false);
  // Dragging back below the threshold hides the revealed page again.
  assert.equal(turnRestVisible(.04, true), false);
});

test("mouse progress maps to the eased video frame and can rewind", () => {
  assert.equal(turnVideoTime(0),0); assert.equal(turnVideoTime(1),1);
  for (const p of [.001,.05,.25,.5,.75,.95,.999]) assert.ok(Math.abs(turnEase(turnVideoTime(p))-p)<1e-6);
  assert.ok(turnVideoTime(.2)<turnVideoTime(.8));
});
