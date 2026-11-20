// Greedy-bot balance check: node --experimental-strip-types tools/simulate-levels.ts
import { makeLevel } from '../src/config/levels.ts';
import { cloneBoard, landingRows, place, resolve } from '../src/systems/board.ts';
import { pieceForLevel, RNG } from '../src/systems/pieces.ts';
import { applyGoalEvent, goalsDone, newGoalState } from '../src/systems/goals.ts';

export function runBot(n: number, seed: number): { won: boolean; left: number } {
  const level = makeLevel(n);
  let board = cloneBoard(level.board);
  const rng = new RNG(seed);
  let state = newGoalState();
  let moves = level.moves;
  let id = 1;
  while (moves > 0) {
    const next = pieceForLevel(rng, n);
    let bestCol = -1; let bestScore = -Infinity;
    for (let c = 0; c < 7; c += 1) {
      if (!landingRows(board, c, next.length)) continue;
      const trial = cloneBoard(board);
      place(trial, c, next, id);
      const r = resolve(trial, id);
      const height = trial.reduce((a, row) => a + (row[c] ? 1 : 0), 0);
      // setup bonus: dropped piece touching same-level flowers / stones
      let adj = 0;
      const row0 = landingRows(board, c, next.length)![0]!;
      for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nb = board[row0 + dy!]?.[c + dx!];
        if (nb?.kind === 'flower' && nb.level === next[0]) adj += 1;
        if (nb?.kind === 'stone') adj += 0.5;
      }
      const sc = adj * 20 + r.cleared * 1000 + r.created.reduce((a, l) => a + l * 50, 0) + r.score - height * 3;
      if (sc > bestScore) { bestScore = sc; bestCol = c; }
    }
    if (bestCol < 0) return { won: false, left: moves };
    place(board, bestCol, next, id); id += next.length; moves -= 1;
    const r = resolve(board, id - next.length);
    state = applyGoalEvent(state, r);
    if (goalsDone(level.goals, state)) return { won: true, left: moves };
  }
  return { won: false, left: 0 };
}

if (process.argv[1]?.endsWith('simulate-levels.ts')) {
  for (let n = 1; n <= 8; n += 1) {
    let wins = 0; let left = 0;
    for (let s = 1; s <= 40; s += 1) { const r = runBot(n, s * 7919); if (r.won) { wins += 1; left += r.left; } }
    console.log(`L${n}: ${wins}/40 wins, avg moves left ${wins ? (left / wins).toFixed(1) : '-'}`);
  }
}
