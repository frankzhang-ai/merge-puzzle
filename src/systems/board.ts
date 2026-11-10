export type Cell = null
  | { kind: 'flower'; level: number; vine?: boolean; id?: number }
  | { kind: 'stone'; hp: number };
export type Grid = Cell[][];

export function emptyBoard(rows = 9, columns = 7): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => null));
}

export function cloneBoard(board: Grid): Grid {
  return board.map((row) => row.map((cell) => cell ? { ...cell } : null));
}

export function canFit(board: Grid, pieceLevels: number[]): boolean {
  const columns = board[0]?.length ?? 0;
  for (let column = 0; column < columns; column += 1) {
    let emptyCount = 0;
    for (let row = 0; row < board.length; row += 1) {
      if (board[row]?.[column] === null) emptyCount += 1;
    }
    if (emptyCount >= pieceLevels.length) return true;
  }
  return false;
}

export function place(board: Grid, column: number, levels: number[], id: number): boolean {
  const emptyRows: number[] = [];
  for (let row = 0; row < board.length; row += 1) {
    if (board[row]?.[column] === null) emptyRows.push(row);
  }
  if (emptyRows.length < levels.length) return false;
  levels.forEach((level, index) => {
    const row = emptyRows[emptyRows.length - 1 - index]!;
    board[row]![column] = { kind: 'flower', level, id: id + index };
  });
  return true;
}

export function gravity(board: Grid): void {
  const columns = board[0]?.length ?? 0;
  for (let column = 0; column < columns; column += 1) {
    let writeRow = board.length - 1;
    for (let row = board.length - 1; row >= 0; row -= 1) {
      const cell = board[row]![column];
      if (cell === null) continue;
      if (writeRow !== row) {
        board[writeRow]![column] = cell;
        board[row]![column] = null;
      }
      writeRow -= 1;
    }
  }
}

interface FlowerGroup { cells: [number, number][]; level: number }
export function groups(board: Grid): FlowerGroup[] {
  const visited = new Set<string>();
  const found: FlowerGroup[] = [];
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cell = board[row]![column];
      const key = `${row},${column}`;
      if (cell?.kind !== 'flower' || cell.vine || visited.has(key)) continue;
      const queue: [number, number][] = [[row, column]];
      const cells: [number, number][] = [];
      visited.add(key);
      for (let index = 0; index < queue.length; index += 1) {
        const [y, x] = queue[index]!;
        cells.push([y, x]);
        for (const [nextY, nextX] of [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]]) {
          const nextKey = `${nextY},${nextX}`;
          const next = board[nextY]?.[nextX];
          if (next?.kind === 'flower' && !next.vine && next.level === cell.level
            && !visited.has(nextKey)) {
            visited.add(nextKey);
            queue.push([nextY, nextX]);
          }
        }
      }
      if (cells.length >= 3) found.push({ cells, level: cell.level });
    }
  }
  return found;
}

export interface ResolveResult { score: number; created: number[]; cleared: number; chain: number }
export function resolve(board: Grid, anchor: number | undefined, startingScore = 0): ResolveResult {
  let score = startingScore;
  let chain = 0;
  let cleared = 0;
  const created: number[] = [];
  while (true) {
    const matches = groups(board);
    if (matches.length === 0) {
      let vineCleared = false;
      for (let row = 0; row < board.length; row += 1) {
        for (let column = 0; column < (board[0]?.length ?? 0); column += 1) {
          const vine = board[row]![column];
          if (vine?.kind !== 'flower' || !vine.vine) continue;
          if (connectedSameLevelCount(board, row, column) >= 3) {
            vine.vine = false;
            cleared += 1;
            vineCleared = true;
          }
        }
      }
      if (vineCleared) {
        gravity(board);
        continue;
      }
      break;
    }

    chain += 1;
    for (const match of matches) {
      const ordered = [...match.cells].sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      const anchorCell = match.cells.find(([row, column]) => {
        const cell = board[row]![column];
        return cell?.kind === 'flower' && cell.id === anchor;
      });
      const [targetRow, targetColumn] = anchorCell ?? ordered[0]!;
      score += match.level * 10 * match.cells.length * chain;
      if (match.level === 8) {
        match.cells.forEach(([row, column]) => { board[row]![column] = null; });
        created.push(8);
      } else {
        match.cells.forEach(([row, column]) => { board[row]![column] = null; });
        board[targetRow]![targetColumn] = { kind: 'flower', level: match.level + 1, id: anchor };
        created.push(match.level + 1);
      }
      for (let row = 0; row < board.length; row += 1) {
        for (let column = 0; column < (board[0]?.length ?? 0); column += 1) {
          const cell = board[row]![column];
          const adjacent = match.cells.some(([y, x]) => Math.abs(y - row) + Math.abs(x - column) === 1);
          if (!adjacent) continue;
          if (cell?.kind === 'stone') {
            cell.hp -= 1;
            if (cell.hp <= 0) {
              board[row]![column] = null;
              cleared += 1;
            }
          } else if (cell?.kind === 'flower' && cell.vine) {
            cell.vine = false;
            cleared += 1;
          }
        }
      }
    }
    gravity(board);
  }
  return { score: score - startingScore, created, cleared, chain };
}

export function boardFull(board: Grid, nextPiece: number[]): boolean {
  return !canFit(board, nextPiece);
}


function connectedSameLevelCount(board: Grid, row: number, column: number): number {
  const start = board[row]?.[column];
  if (start?.kind !== 'flower') return 0;
  const seen = new Set<string>();
  const queue: [number, number][] = [[row, column]];
  seen.add(`${row},${column}`);
  for (let index = 0; index < queue.length; index += 1) {
    const [y, x] = queue[index]!;
    for (const [nextY, nextX] of [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]]) {
      const key = `${nextY},${nextX}`;
      const cell = board[nextY]?.[nextX];
      if (cell?.kind === 'flower' && cell.level === start.level && !seen.has(key)) {
        seen.add(key);
        queue.push([nextY, nextX]);
      }
    }
  }
  return seen.size;
}

export function landingRows(board: Grid, column: number, count: number): number[] | null {
  const empty: number[] = [];
  for (let row = 0; row < board.length; row += 1) {
    if (board[row]?.[column] === null) empty.push(row);
  }
  if (empty.length < count) return null;
  const rows: number[] = [];
  for (let index = 0; index < count; index += 1) {
    rows.push(empty[empty.length - 1 - index]!);
  }
  return rows;
}
export class RNG {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  int(max: number): number { return Math.floor(this.next() * max); }
}

export function piece(random: RNG, maxLevel = 2): number[] {
  const pairChance = Math.min(0.5, Math.max(0.08, (maxLevel - 1) * 0.1));
  const pair = maxLevel >= 2 && random.next() < pairChance;
  const cap = Math.min(4, maxLevel);
  return Array.from({ length: pair ? 2 : 1 }, () => 1 + random.int(cap));
}
