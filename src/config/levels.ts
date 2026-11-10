import { emptyBoard, type Grid } from '../systems/board.ts';

export type GoalKind = 'make' | 'clear' | 'score';
export interface LevelGoal {
  kind: GoalKind;
  target: number;
  level?: number;
}
export interface Level {
  n: number;
  boss: boolean;
  goals: LevelGoal[];
  kind: GoalKind;
  target: number;
  level?: number;
  extra?: LevelGoal;
  moves: number;
  twoStar: number;
  threeStar: number;
  bias: string;
  board: Grid;
}

type LevelRow = [GoalKind, number, number | undefined, number, number, number, string];
const rows: LevelRow[] = [
  ['make', 1, 3, 20, 3, 8, 'mostly singles L1; occasional L2'],
  ['make', 2, 3, 18, 3, 7, 'singles L1–L2'],
  ['score', 200, undefined, 20, 3, 8, 'singles L1–L2'],
  ['clear', 3, undefined, 16, 3, 6, 'singles L1–L2'],
  ['make', 1, 4, 18, 3, 7, 'singles L1–L2'],
  ['make', 3, 3, 18, 3, 7, 'occasional pairs L1–L2'],
  ['clear', 4, undefined, 16, 3, 6, 'singles and pairs L1–L2'],
  ['score', 400, undefined, 18, 3, 6, 'singles L1–L3'],
  ['make', 2, 4, 20, 3, 7, 'singles L1–L3'],
  ['make', 1, 5, 20, 3, 7, 'mixed L1–L3'],
  ['clear', 4, undefined, 18, 3, 6, 'singles L1–L3'],
  ['make', 4, 3, 16, 3, 5, 'singles L1–L3'],
  ['score', 600, undefined, 18, 3, 6, 'singles and pairs L1–L3'],
  ['clear', 6, undefined, 20, 3, 7, 'mixed L1–L3'],
  ['make', 2, 5, 22, 3, 8, 'singles and pairs L1–4'],
  ['make', 3, 4, 20, 3, 7, 'singles and pairs L1–4'],
  ['clear', 6, undefined, 18, 3, 6, 'singles and pairs L1–4'],
  ['score', 800, undefined, 20, 3, 6, 'singles and pairs L1–4'],
  ['make', 1, 6, 24, 3, 8, 'pieces L1–L3'],
  ['make', 1, 6, 24, 3, 8, 'pieces L1–4'],
  ['clear', 7, undefined, 20, 3, 6, 'mixed L1–4'],
  ['make', 4, 4, 20, 3, 6, 'pieces L1–4'],
  ['score', 1000, undefined, 20, 3, 6, 'pieces L1–4'],
  ['make', 2, 6, 24, 3, 8, 'pieces L1–4'],
  ['make', 1, 7, 26, 3, 9, 'pieces L1–5'],
  ['make', 5, 4, 22, 3, 7, 'pieces L1–5'],
  ['clear', 8, undefined, 22, 3, 7, 'mixed L1–5'],
  ['score', 1500, undefined, 22, 3, 7, 'pieces L1–5'],
  ['make', 2, 7, 26, 3, 8, 'pieces L1–4'],
  ['make', 1, 8, 30, 3, 10, 'pieces L1–4'],
];

const bosses = new Set([5, 10, 15, 20, 25, 30]);
const stoneCells: Record<number, number[][]> = {
  3: [[8, 3]],
  4: [[4, 1], [5, 3], [4, 5]],
  5: [[5, 2], [6, 4]],
  10: [[4, 1], [6, 3], [4, 5]],
  11: [[4, 1], [5, 3], [4, 5], [6, 5]],
  14: [[5, 1], [4, 3], [4, 5]],
  15: [[5, 2], [5, 4]],
  20: [[4, 1], [6, 3], [4, 5], [6, 5]],
  21: [[4, 1], [6, 3], [4, 5], [6, 5], [5, 2]],
  25: [[4, 1], [6, 3], [4, 5], [6, 5]],
  27: [[4, 1], [6, 3], [4, 5], [6, 5]],
  30: [[4, 1], [6, 3], [4, 5], [6, 5]],
};
const vineCells: Record<number, number[][]> = {
  3: [[7, 2]],
  7: [[6, 0], [6, 2], [6, 4], [6, 6]],
  14: [[6, 0], [6, 6], [5, 3]],
  17: [[6, 0], [6, 2], [6, 4], [6, 6], [7, 1], [7, 5]],
  21: [[7, 0], [7, 6]],
  25: [[7, 0], [7, 6], [8, 2]],
  27: [[7, 0], [7, 6], [8, 2], [8, 4]],
};
const extraBossGoals: Record<number, LevelGoal[]> = {
  5: [{ kind: 'clear', target: 2 }],
  10: [{ kind: 'clear', target: 3 }],
  15: [{ kind: 'score', target: 200 }],
  20: [{ kind: 'clear', target: 4 }],
  25: [{ kind: 'clear', target: 7 }],
  30: [{ kind: 'score', target: 800 }, { kind: 'clear', target: 4 }],
};

export function makeLevel(n: number): Level {
  const row = rows[n - 1];
  if (!row) throw new RangeError(`Unknown level ${n}`);
  const [kind, target, level, moves, twoStar, threeStar, bias] = row;
  const board = emptyBoard();
  const stones = stoneCells[n] ?? [];
  stones.forEach(([r, c], index) => {
    const tough = (n === 10 && index === 0) || (n === 20 && index === 0)
      || (n === 25 && index < 2) || (n === 30 && index < 2);
    board[r]![c] = { kind: 'stone', hp: tough ? 2 : 1 };
  });
  (vineCells[n] ?? []).forEach(([r, c], index) => {
    board[r]![c] = { kind: 'flower', level: index % 2 + 1, vine: true };
  });
  if (n === 5) {
    board[8]![0] = { kind: 'flower', level: 1 };
    board[8]![6] = { kind: 'flower', level: 1 };
  }
  return {
    n,
    boss: bosses.has(n),
    goals: [{ kind, target, ...(level ? { level } : {}) }, ...(extraBossGoals[n] ?? [])],
    kind,
    target,
    ...(level ? { level } : {}),
    ...(extraBossGoals[n]?.[0] ? { extra: extraBossGoals[n][0] } : {}),
    moves,
    twoStar,
    threeStar,
    bias,
    board,
  };
}

export const levels = Array.from({ length: 30 }, (_, index) => makeLevel(index + 1));
