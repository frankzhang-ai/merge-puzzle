export type PowerUpKind = 'undo' | 'hammer' | 'shuffle';
export interface DailyUses {
  date: string;
  undo: number;
  hammer: number;
  shuffle: number;
}

export function dailyUses(saved: DailyUses | null, today: string): DailyUses {
  if (saved?.date === today) return { ...saved };
  return { date: today, undo: 1, hammer: 1, shuffle: 1 };
}

export function consumeUse(uses: DailyUses, kind: PowerUpKind): DailyUses | null {
  if (uses[kind] <= 0) return null;
  return { ...uses, [kind]: uses[kind] - 1 };
}

export function canUndo(snapshot: unknown): boolean {
  return snapshot !== null && snapshot !== undefined;
}

/** Campaign level at which each tool unlocks (single source of truth for UI + tutorial). */
export const TOOL_UNLOCK_LEVEL: Record<PowerUpKind, number> = { undo: 2, hammer: 3, shuffle: 4 };

/** Highest campaign level the player has reached (first level without a clear, capped at 30). */
export function reachedLevel(bestStars: number[]): number {
  let level = 1;
  while (level < 30 && (bestStars[level - 1] ?? 0) > 0) level += 1;
  return level;
}

export function toolUnlocked(kind: PowerUpKind, bestStars: number[]): boolean {
  return reachedLevel(bestStars) >= TOOL_UNLOCK_LEVEL[kind];
}

export function lockLabel(kind: PowerUpKind): string {
  return `Unlock at Lv. ${TOOL_UNLOCK_LEVEL[kind]}`;
}
