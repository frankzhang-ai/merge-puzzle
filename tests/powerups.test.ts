import test from 'node:test';
import assert from 'node:assert/strict';
import { canUndo, consumeUse, dailyUses } from '../src/systems/powerups.ts';

test('daily power-up uses reset on the local date boundary', () => {
  const yesterday = dailyUses(null, '2026-11-09');
  const usedUndo = consumeUse(yesterday, 'undo');
  assert.equal(usedUndo?.undo, 0);
  assert.equal(dailyUses(usedUndo, '2026-11-09').undo, 0);
  assert.equal(dailyUses(usedUndo, '2026-11-10').undo, 1);
});

test('an empty undo does not spend its free use', () => {
  const uses = dailyUses(null, '2026-11-10');
  assert.equal(canUndo(null), false);
  assert.equal(consumeUse(uses, 'undo')?.undo, 0);
  assert.equal(uses.undo, 1);
  assert.equal(consumeUse({ ...uses, undo: 0 }, 'undo'), null);
});
