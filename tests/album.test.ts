import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverFlowers, hasRainbowGarden } from '../src/systems/album.ts';

test('Rainbow Garden requires all eight discovered flowers', () => {
  let discoveries = Array(8).fill(false) as boolean[];
  discoveries = discoverFlowers(discoveries, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(hasRainbowGarden(discoveries), false);
  discoveries = discoverFlowers(discoveries, [8]);
  assert.equal(hasRainbowGarden(discoveries), true);
  assert.deepEqual(discoverFlowers(discoveries, []), discoveries);
});
