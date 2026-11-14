import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PINK_NEW_ANIMATIONS } from '../src/lib/portfolia/pink-animation-placement';
import { validatePageSticker } from '../src/lib/portfolia/page-extras';

test('replacement Pink clips retain their IDs and valid page placements', () => {
  assert.deepEqual(PINK_NEW_ANIMATIONS.map(p => p.page), [6, 7, 8, 9, 12, 13, 14, 15, 18, 19, 22]);
  for (const p of PINK_NEW_ANIMATIONS) {
    assert.equal(p.id, p.name.replace(/\.webp$/, ''));
    assert.match(p.sha256, /^[a-f0-9]{64}$/);
    assert.equal(validatePageSticker({ ...p, half: 'right', sticker: 'animation', colour: '#1c1c1c', image: { key: 'anim_test' } }, 24), null);
  }
});

test('mouse and bulb clips cover their actual artwork, not the formerly incorrect targets', () => {
  const mouse = PINK_NEW_ANIMATIONS.find(p => p.page === 9)!;
  const bulb = PINK_NEW_ANIMATIONS.find(p => p.page === 8)!;
  const near = (value: number, target: number, tolerance: number) => assert.ok(Math.abs(value - target) < tolerance);
  // Centres measured on the original 640px source pages.
  near(mouse.x + mouse.size / 2, 385 / 640, .015);
  near(mouse.y + mouse.size / 2, 112 / 640, .015);
  assert.ok(mouse.size < .09);
  near(bulb.x + bulb.size / 2, 177 / 640, .02);
  near(bulb.y + bulb.size / 2, 220 / 640, .02);
});
