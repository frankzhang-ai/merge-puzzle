export function stars(movesLeft: number, twoStar: number, threeStar: number): number {
  if (movesLeft >= threeStar) return 3;
  if (movesLeft >= twoStar) return 2;
  return 1;
}

export function unlocked(bestStars: number[], level: number): boolean {
  return level === 1 || (bestStars[level - 2] ?? 0) > 0;
}
