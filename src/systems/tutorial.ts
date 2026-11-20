import { cloneBoard, emptyBoard, landingRows, type Grid } from './board.ts';

/**
 * Data-driven tutorial. Every step names a target, how it advances, and which
 * board facts it REQUIRES. `firstValidStep` re-checks those facts after every
 * resolve/draw and skips steps whose target vanished or whose lesson is already
 * moot, so the dim overlay can never appear without a working highlighted target.
 */
export type ToolName = 'undo' | 'hammer' | 'shuffle';
export type TutorialTarget =
  | { type: 'column'; column: number }
  | { type: 'button'; button: ToolName }
  | { type: 'none' };
export type StepRequirement = 'stone' | 'vine' | 'undoable' | 'shuffleable' | 'toolUnlocked';
export type AdvanceWhen = 'drop' | 'tool' | 'ack';

export interface TutorialStep {
  id: string;
  level: number;
  hint: string;
  target: TutorialTarget;
  advanceWhen: AdvanceWhen;
  requires?: StepRequirement[];
  /** The step is only valid while the upcoming piece equals this. */
  needsNext?: number[];
}

export interface TutorialScript {
  level: number;
  scriptedBoard?: Grid;
  scriptedQueue?: number[][];
}

export interface TutorialContext {
  board: Grid;
  next: number[];
  canUndo: boolean;
  toolUnlocked: (tool: ToolName) => boolean;
}

export type TutorialEvent =
  | { type: 'drop'; column: number }
  | { type: 'tool'; tool: ToolName }
  | { type: 'ack' };

export const TUTORIAL_LEVELS = [1, 2, 3, 4] as const;

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'l1-drop', level: 1, hint: 'Tap a column to drop the flower.', target: { type: 'column', column: 1 }, advanceWhen: 'drop', needsNext: [1] },
  { id: 'l1-merge', level: 1, hint: 'Match 3 same flowers to merge them.', target: { type: 'column', column: 3 }, advanceWhen: 'drop', needsNext: [2] },
  { id: 'l2-chain', level: 2, hint: 'Merges can chain! Drop here.', target: { type: 'column', column: 2 }, advanceWhen: 'drop', needsNext: [2] },
  { id: 'l2-undo', level: 2, hint: 'Undo takes back your last drop.', target: { type: 'button', button: 'undo' }, advanceWhen: 'tool', requires: ['undoable', 'toolUnlocked'] },
  { id: 'l3-stone', level: 3, hint: 'A merge next to a stone cracks it.', target: { type: 'column', column: 0 }, advanceWhen: 'drop', requires: ['stone'], needsNext: [1] },
  { id: 'l3-vine', level: 3, hint: 'Vines unwrap when a merge happens beside them.', target: { type: 'column', column: 6 }, advanceWhen: 'drop', requires: ['vine'], needsNext: [1] },
  { id: 'l3-hammer', level: 3, hint: 'Hammer clears one tile. Tap it, then tap a tile.', target: { type: 'button', button: 'hammer' }, advanceWhen: 'tool', requires: ['toolUnlocked'] },
  { id: 'l4-shuffle', level: 4, hint: 'Shuffle rearranges your flowers when you are stuck.', target: { type: 'button', button: 'shuffle' }, advanceWhen: 'tool', requires: ['shuffleable', 'toolUnlocked'] },
];

export function stepsForLevel(level: number): TutorialStep[] {
  return TUTORIAL_STEPS.filter((step) => step.level === level);
}

type F = [number, number, number];
function fill(board: Grid, flowers: F[]): Grid {
  for (const [row, column, level] of flowers) board[row]![column] = { kind: 'flower', level };
  return board;
}

/** Scripted boards/queues so every tutorial target exists when its step shows. */
export function scriptForLevel(level: number): TutorialScript | null {
  if (level === 1) {
    return {
      level,
      scriptedBoard: fill(emptyBoard(), [[8, 0, 1], [8, 2, 2], [8, 4, 2], [8, 6, 1], [7, 6, 3]]),
      scriptedQueue: [[1], [2]],
    };
  }
  if (level === 2) {
    return {
      level,
      scriptedBoard: fill(emptyBoard(), [[8, 0, 3], [8, 1, 3], [8, 3, 2], [8, 4, 2], [8, 6, 1], [8, 5, 1]]),
      scriptedQueue: [[2]],
    };
  }
  if (level === 3) {
    const board = fill(emptyBoard(), [[8, 1, 1], [8, 2, 1], [8, 4, 3], [8, 6, 1], [7, 6, 1]]);
    board[8]![3] = { kind: 'stone', hp: 1 };
    board[8]![5] = { kind: 'flower', level: 2, vine: true };
    return { level, scriptedBoard: board, scriptedQueue: [[1], [1]] };
  }
  if (level === 4) return { level, scriptedQueue: [] };
  return null;
}

export function scriptBoard(level: number): Grid | null {
  const script = scriptForLevel(level);
  return script?.scriptedBoard ? cloneBoard(script.scriptedBoard) : null;
}

function has(board: Grid, test: (cell: NonNullable<Grid[number][number]>) => boolean): boolean {
  return board.some((row) => row.some((cell) => cell !== null && test(cell)));
}

export function stepValid(step: TutorialStep, ctx: TutorialContext): boolean {
  if (step.needsNext && step.needsNext.join() !== ctx.next.join()) return false;
  for (const need of step.requires ?? []) {
    if (need === 'stone' && !has(ctx.board, (c) => c.kind === 'stone')) return false;
    if (need === 'vine' && !has(ctx.board, (c) => c.kind === 'flower' && Boolean(c.vine))) return false;
    if (need === 'undoable' && !ctx.canUndo) return false;
    if (need === 'shuffleable'
      && ctx.board.flat().filter((c) => c?.kind === 'flower' && !c.vine).length < 2) return false;
    if (need === 'toolUnlocked' && step.target.type === 'button' && !ctx.toolUnlocked(step.target.button)) return false;
  }
  if (step.target.type === 'column' && !landingRows(ctx.board, step.target.column, ctx.next.length)) return false;
  return true;
}

/** Index of the first still-valid step at or after `from`; steps.length means finished. */
export function firstValidStep(steps: TutorialStep[], from: number, ctx: TutorialContext): number {
  let index = from;
  while (index < steps.length && !stepValid(steps[index]!, ctx)) index += 1;
  return index;
}

export function isWrongColumn(step: TutorialStep | undefined, column: number): boolean {
  return step?.target.type === 'column' && step.target.column !== column;
}

/** True when the event completes the step. */
export function completes(step: TutorialStep, event: TutorialEvent): boolean {
  if (event.type === 'ack') return step.target.type !== 'column';
  if (event.type === 'drop') return step.advanceWhen === 'drop' && step.target.type === 'column' && step.target.column === event.column;
  return step.advanceWhen === 'tool' && step.target.type === 'button' && step.target.button === event.tool;
}
