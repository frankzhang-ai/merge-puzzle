export function dateSeed(date: string): number {
  return Number(date.replaceAll('-', ''));
}

export function dailyGoal(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const dayIndex = Math.floor((Date.UTC(year!, month! - 1, day!) - Date.UTC(year!, 0, 0)) / 86400000);
  const kind = (['make', 'clear', 'score', 'combined'] as const)[dayIndex % 4]!;
  const target = kind === 'make' ? 2 : kind === 'clear' ? 4 : kind === 'score' ? 600 : 3;
  return { kind, target, level: 4, extra: kind === 'combined' ? { kind: 'clear' as const, target: 3 } : null };
}

export function updateStreak(last: string | null, today: string, streak: number): number {
  if (last === today) return streak;
  if (last) {
    const previous = new Date(`${last}T12:00:00`);
    previous.setDate(previous.getDate() + 1);
    if (previous.toISOString().slice(0, 10) === today) return streak + 1;
  }
  return 1;
}
