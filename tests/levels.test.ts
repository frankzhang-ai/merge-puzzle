import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/config/levels.ts';
import { groups } from '../src/systems/board.ts';
import { runBot } from '../tools/simulate-levels.ts';
import { lockLabel, reachedLevel, toolUnlocked, TOOL_UNLOCK_LEVEL } from '../src/systems/powerups.ts';
import { nextStarSkin } from '../src/systems/progress.ts';

test('starting boards have no instant matches and nothing floats (levels 1-6)', () => {
  for (const level of levels.slice(0, 6)) {
    assert.equal(groups(level.board).length, 0, `level ${level.n} has an instant match`);
    for (let c = 0; c < 7; c += 1) {
      let seenEmpty = false;
      for (let r = 8; r >= 0; r -= 1) {
        const cell = level.board[r]![c];
        if (cell === null) seenEmpty = true;
        else assert.equal(seenEmpty, false, `level ${level.n} col ${c} floats`);
      }
    }
    assert.ok(level.board.flat().some((cell) => cell?.kind === 'flower'), `level ${level.n} is empty`);
  }
});

test('level 4 is gentle: clear <=3 obstacles with 20+ moves, greedy bot wins', () => {
  const l4 = levels[3]!;
  assert.equal(l4.goals[0]!.kind, 'clear');
  assert.ok(l4.goals[0]!.target <= 3);
  assert.ok(l4.moves >= 20);
  let wins = 0;
  for (let s = 1; s <= 10; s += 1) if (runBot(4, s * 7919).won) wins += 1;
  assert.ok(wins >= 8, `bot won ${wins}/10`);
});

test('tool unlock levels are consistent', () => {
  assert.deepEqual(TOOL_UNLOCK_LEVEL, { undo: 2, hammer: 3, shuffle: 4 });
  assert.equal(reachedLevel([]), 1);
  assert.equal(toolUnlocked('undo', []), false);
  assert.equal(toolUnlocked('undo', [3]), true);
  assert.equal(toolUnlocked('shuffle', [3, 3]), false);
  assert.equal(toolUnlocked('shuffle', [3, 3, 1]), true);
  assert.equal(lockLabel('hammer'), 'Unlock at Lv. 3');
});

test('star skin progress', () => {
  assert.deepEqual(nextStarSkin([3, 3], []), { skin: 'Dawn Petal', remaining: 9 });
  assert.equal(nextStarSkin(Array(30).fill(3), ['Dawn Petal', 'Night Bloom']), null);
});
