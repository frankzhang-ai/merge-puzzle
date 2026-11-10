import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/config/levels.ts';
import { stars, unlocked } from '../src/systems/progress.ts';

test('level one star thresholds match the goal card', () => {
  assert.equal(levels[0]?.twoStar, 3);
  assert.equal(levels[0]?.threeStar, 8);
  assert.equal(stars(2, 3, 8), 1);
  assert.equal(stars(3, 3, 8), 2);
  assert.equal(stars(8, 3, 8), 3);
});

test('only level one starts before a prior level is cleared', () => {
  assert.equal(unlocked([], 1), true);
  assert.equal(unlocked([], 2), false);
  assert.equal(unlocked([1], 2), true);
});

test('level 30 requires flower, score, and obstacle goals', () => {
  assert.deepEqual(levels[29]?.goals, [
    { kind: 'make', target: 1, level: 8 },
    { kind: 'score', target: 800 },
    { kind: 'clear', target: 4 },
  ]);
});
