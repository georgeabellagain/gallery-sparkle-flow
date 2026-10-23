import { test } from "node:test";
import assert from "node:assert/strict";
import { clampOrbit, isOrbiting, ORBIT_LIMITS, orbitDirection, orbitDrag, orbitTilt } from "../src/lib/portfolia/orbit-view";

test("the 3D view stays on the cap of the dome above the book", () => {
  for (let yaw = -3; yaw <= 3; yaw += 0.25) for (let pitch = -3; pitch <= 3; pitch += 0.25) {
    const o = clampOrbit({ yaw, pitch });
    assert.ok(Math.abs(o.yaw) <= ORBIT_LIMITS.yaw + 1e-9);
    assert.ok(o.pitch <= ORBIT_LIMITS.pitch + 1e-9 && o.pitch >= -ORBIT_LIMITS.back - 1e-9);
    assert.ok(orbitTilt(o) <= ORBIT_LIMITS.tilt + 1e-6);
    // Always above the book, looking down at it.
    assert.ok(orbitDirection(o).z > 0.45);
  }
});

test("straight down is the normal view and the direction is a unit vector", () => {
  assert.equal(isOrbiting({ yaw: 0, pitch: 0 }), false);
  assert.deepEqual(orbitDirection({ yaw: 0, pitch: 0 }), { x: 0, y: -0, z: 1 });
  const d = orbitDirection({ yaw: 0.4, pitch: 0.3 });
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
});

test("dragging past a stop holds there instead of jumping", () => {
  let o = { yaw: 0, pitch: 0 };
  let previous = o;
  for (let i = 0; i < 400; i++) {
    o = orbitDrag(o, -12, -9, 800);
    assert.ok(Math.hypot(o.yaw - previous.yaw, o.pitch - previous.pitch) < 0.06);
    previous = o;
  }
  assert.ok(orbitTilt(o) <= ORBIT_LIMITS.tilt + 1e-6);
});
