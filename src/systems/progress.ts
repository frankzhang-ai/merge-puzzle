export function stars(movesLeft: number, twoStar: number, threeStar: number): number {
  if (movesLeft >= threeStar) return 3;
  if (movesLeft >= twoStar) return 2;
  return 1;
}

export function unlocked(bestStars: number[], level: number): boolean {
  return level === 1 || (bestStars[level - 2] ?? 0) > 0;
}

export function totalStars(bestStars: number[]): number {
  return bestStars.reduce((sum, value) => sum + (value || 0), 0);
}

/** Skins that also unlock from total campaign stars. */
export const STAR_SKINS: ReadonlyArray<readonly [string, number]> = [['Dawn Petal', 15], ['Night Bloom', 40]];

export function nextStarSkin(bestStars: number[], owned: string[]): { skin: string; remaining: number } | null {
  const total = totalStars(bestStars);
  for (const [skin, need] of STAR_SKINS) {
    if (!owned.includes(skin) && total < need) return { skin, remaining: need - total };
  }
  return null;
}

/** Stars still needed in moves-left terms: how many more spare moves earn 3★ (0 when already 3★). */
export function movesToThreeStars(movesLeft: number, threeStar: number): number {
  return Math.max(0, threeStar - movesLeft);
}
