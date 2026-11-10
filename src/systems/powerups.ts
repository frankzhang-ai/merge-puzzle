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
