import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLevel } from '../src/config/levels.ts';
import { emptyBoard, resolve, resolveSteps, gravity, shuffleBoard, type Grid } from '../src/systems/board.ts';
import {
  applyGoalEvent, cloneGoalState, goalDone, goalProgress, goalsDone, newGoalState, type GoalSpec, type GoalState,
} from '../src/systems/goals.ts';

const f = (level: number, extra: object = {}) => ({ kind: 'flower' as const, level, ...extra });
const applySteps = (state: GoalState, board: Grid, anchor?: number): GoalState => {
  let next = state;
  for (const step of resolveSteps(board, anchor)) next = applyGoalEvent(next, { created: step.created, cleared: step.cleared, score: step.score });
  return next;
};
const row3 = (level = 1): Grid => {
  const b = emptyBoard();
  for (let c = 0; c < 3; c += 1) b[8]![c] = f(level);
  return b;
};

test('every goal starts at 0', () => {
  const s = newGoalState();
  for (const goal of [{ kind: 'make', target: 3, level: 3 }, { kind: 'clear', target: 3 }, { kind: 'score', target: 200 }] as GoalSpec[]) {
    assert.equal(goalProgress(goal, s), 0);
    assert.equal(goalDone(goal, s), false);
  }
});

test('make counts merges producing exactly that level', () => {
  const goal: GoalSpec = { kind: 'make', target: 1, level: 2 };
  const s = applySteps(newGoalState(), row3(1));
  assert.equal(goalProgress(goal, s), 1);
  assert.equal(goalProgress({ kind: 'make', target: 1, level: 3 }, s), 0);
  assert.ok(goalDone(goal, s));
});

test('clear counts a stone once, when destroyed', () => {
  const b = row3(1);
  b[8]![3] = { kind: 'stone', hp: 1 };
  const s = applySteps(newGoalState(), b);
  assert.equal(s.cleared, 1);
  assert.equal(goalProgress({ kind: 'clear', target: 3 }, s), 1);
});

test('clear counts an hp2 stone only when it breaks', () => {
  const b = row3(1);
  b[8]![3] = { kind: 'stone', hp: 2 };
  let s = applySteps(newGoalState(), b);
  assert.equal(s.cleared, 0);
  const again = emptyBoard();
  again[8]![3] = b[8]![3];
  for (let c = 0; c < 3; c += 1) again[8]![c] = f(1);
  s = applySteps(s, again);
  assert.equal(s.cleared, 1);
});

test('clear counts an unwrapped vine', () => {
  const b = row3(1);
  b[7]![2] = f(2, { vine: true });
  const s = applySteps(newGoalState(), b);
  assert.equal(s.cleared, 1);
});

test('score goal tracks score and clamps display at target', () => {
  const goal: GoalSpec = { kind: 'score', target: 20 };
  const s = applySteps(newGoalState(), row3(2));
  assert.ok(s.score > 20);
  assert.equal(goalProgress(goal, s), 20);
  assert.ok(goalDone(goal, s));
});

test('boss multi-goal needs every goal', () => {
  const level = makeLevel(5);
  assert.ok(level.goals.length >= 2);
  let s = newGoalState();
  s = applyGoalEvent(s, { created: Array(level.goals[0]!.target).fill(level.goals[0]!.level) });
  assert.equal(goalsDone(level.goals, s), false);
  s = applyGoalEvent(s, { cleared: level.goals[1]!.target });
  assert.equal(goalsDone(level.goals, s), true);
});

test('restart resets to 0 and undo reverts progress (immutable states)', () => {
  const before = newGoalState();
  const snapshot = cloneGoalState(before);
  const after = applySteps(before, row3(1));
  assert.equal(before.score, 0);
  assert.ok(after.score > 0);
  assert.deepEqual(snapshot, before);
  const restarted = newGoalState();
  assert.deepEqual(restarted, { made: {}, cleared: 0, score: 0 });
});

test('hammer clearing a stone counts', () => {
  const s = applyGoalEvent(newGoalState(), { cleared: 1 });
  assert.equal(goalProgress({ kind: 'clear', target: 3 }, s), 1);
});

test('shuffle changes no counts when no match forms', () => {
  const b = emptyBoard();
  [[8, 0, 1], [8, 1, 2], [8, 2, 3], [8, 3, 1], [8, 4, 2], [8, 5, 3]].forEach(([r, c, l]) => { b[r!]![c!] = f(l!); });
  gravity(b);
  let n = 0;
  shuffleBoard(b, () => ((n += 1) * 0.37) % 1);
  const result = resolve(b, undefined);
  assert.equal(result.chain, 0);
  const s = applyGoalEvent(newGoalState(), { created: result.created, cleared: result.cleared, score: result.score });
  assert.deepEqual(s, newGoalState());
});

test('level complete detection', () => {
  const level = makeLevel(4);
  let s = newGoalState();
  assert.equal(goalsDone(level.goals, s), false);
  s = applyGoalEvent(s, { cleared: level.goals[0]!.target });
  assert.equal(goalsDone(level.goals, s), true);
  assert.equal(goalsDone([], s), false);
});

test('every level goal intro starts at 0/target', () => {
  for (let n = 1; n <= 30; n += 1) {
    for (const goal of makeLevel(n).goals) assert.equal(goalProgress(goal, newGoalState()), 0);
  }
});
