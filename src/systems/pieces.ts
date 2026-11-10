import { RNG, piece as randomPiece } from './board.ts';

export { RNG, randomPiece as piece };

/** Campaign piece bias: early levels stay on low singles, later levels add pairs. */
export function pieceForLevel(random: RNG, levelNo: number): number[] {
  const maxLevel = levelNo <= 5 ? 2
    : levelNo <= 11 ? 3
    : levelNo <= 24 ? 4
    : 5;
  const cap = Math.min(4, maxLevel);
  const pairChance = levelNo <= 5 ? 0.04 : levelNo <= 12 ? 0.16 : 0.28;
  const isPair = cap >= 2 && random.next() < pairChance;
  const count = isPair ? 2 : 1;
  const levels: number[] = [];
  for (let index = 0; index < count; index += 1) {
    // Early levels favor L1; later levels use the full cap more evenly.
    if (levelNo <= 2 && random.next() < 0.8) levels.push(1);
    else levels.push(1 + random.int(cap));
  }
  return levels;
}

export function pieceForDaily(random: RNG): number[] {
  return randomPiece(random, 3);
}
