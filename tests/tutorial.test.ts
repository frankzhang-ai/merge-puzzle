import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyBoard, resolveSteps } from '../src/systems/board.ts';
import {
  completes, firstValidStep, isWrongColumn, scriptBoard, scriptForLevel, stepsForLevel, stepValid,
} from '../src/systems/tutorial.ts';

const ctx = (level: number, next: number[], over: object = {}) => ({
  board: scriptBoard(level) ?? emptyBoard(), next, canUndo: true, toolUnlocked: () => true, ...over,
});

test('every first step of a scripted level is valid on its scripted board', () => {
  for (const level of [1, 2, 3]) {
    const script = scriptForLevel(level)!;
    const steps = stepsForLevel(level);
    assert.equal(firstValidStep(steps, 0, ctx(level, script.scriptedQueue![0]!)), 0, `level ${level}`);
  }
});

test('level 3: stone cleared early skips the stone step, never stalls', () => {
  const steps = stepsForLevel(3);
  const board = scriptBoard(3)!;
  board[8]![3] = null;
  assert.equal(firstValidStep(steps, 0, { ...ctx(3, [1]), board }), 1);
});

test('level 3: vine and stone both gone skips to the hammer tip, then ends', () => {
  const steps = stepsForLevel(3);
  const board = emptyBoard();
  assert.equal(steps[firstValidStep(steps, 0, { ...ctx(3, [1]), board })]?.id, 'l3-hammer');
  assert.equal(firstValidStep(steps, 0, { ...ctx(3, [1]), board, toolUnlocked: () => false }), steps.length);
});

test('level 3 scripted lessons: A cracks only the stone, B unwraps only the vine', () => {
  const a = scriptBoard(3)!;
  a[8]![0] = { kind: 'flower', level: 1 };
  const stepsA = resolveSteps(a, undefined);
  assert.equal(stepsA.reduce((n, s) => n + s.cleared, 0), 1);
  assert.equal(a[8]![5]?.kind === 'flower' && a[8]![5].vine, true);
  const b = scriptBoard(3)!;
  b[6]![6] = { kind: 'flower', level: 1 };
  const stepsB = resolveSteps(b, undefined);
  assert.equal(stepsB.reduce((n, s) => n + s.cleared, 0), 1);
  assert.equal(b[8]![3]?.kind, 'stone');
});

test('level 1 and 2 scripts finish the lesson in one merge', () => {
  const b1 = scriptBoard(1)!;
  b1[8]![1] = { kind: 'flower', level: 1 };
  assert.equal(resolveSteps(b1, undefined).length, 0);
  b1[8]![3] = { kind: 'flower', level: 2 };
  assert.ok(resolveSteps(b1, undefined).flatMap((s) => s.created).includes(3));
  const b2 = scriptBoard(2)!;
  b2[8]![2] = { kind: 'flower', level: 2 };
  assert.equal(resolveSteps(b2, undefined).length, 2);
});

test('button steps need unlocked tool and state; wrong column detection; events', () => {
  const [undo] = stepsForLevel(2).filter((s) => s.id === 'l2-undo');
  assert.equal(stepValid(undo!, ctx(2, [1], { canUndo: false })), false);
  assert.equal(stepValid(undo!, ctx(2, [1])), true);
  assert.equal(completes(undo!, { type: 'tool', tool: 'undo' }), true);
  assert.equal(completes(undo!, { type: 'ack' }), true);
  const drop = stepsForLevel(1)[0]!;
  assert.equal(isWrongColumn(drop, 4), true);
  assert.equal(isWrongColumn(drop, 1), false);
  assert.equal(completes(drop, { type: 'ack' }), false);
  const shuffle = stepsForLevel(4)[0]!;
  assert.equal(stepValid(shuffle, ctx(4, [1])), false);
});
