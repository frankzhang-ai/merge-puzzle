/**
 * Pure goal tracking. Semantics (single source of truth):
 *  - make:  counts merges that PRODUCE a flower of exactly `goal.level` (default 3).
 *           Flowers pre-placed on the board never count.
 *  - clear: counts obstacles removed: a stone counts once, when its hp reaches 0
 *           (a 2-hp stone counts on the second hit); a vine counts once when unwrapped.
 *  - score: the running score.
 * Progress always starts at 0 (newGoalState) and is clamped to the target for display.
 */
export type GoalKind = 'make' | 'clear' | 'score';
export interface GoalSpec { kind: GoalKind; target: number; level?: number }
export interface GoalState {
  made: Record<number, number>;
  cleared: number;
  score: number;
}
export interface GoalEvent { created?: number[]; cleared?: number; score?: number }

export function newGoalState(): GoalState {
  return { made: {}, cleared: 0, score: 0 };
}

export function cloneGoalState(state: GoalState): GoalState {
  return { made: { ...state.made }, cleared: state.cleared, score: state.score };
}

/** Returns a NEW state with the event applied (inputs are never mutated). */
export function applyGoalEvent(state: GoalState, event: GoalEvent): GoalState {
  const next = cloneGoalState(state);
  for (const level of event.created ?? []) next.made[level] = (next.made[level] ?? 0) + 1;
  next.cleared += Math.max(0, event.cleared ?? 0);
  next.score += Math.max(0, event.score ?? 0);
  return next;
}

export function rawProgress(goal: GoalSpec, state: GoalState): number {
  if (goal.kind === 'make') return state.made[goal.level ?? 3] ?? 0;
  if (goal.kind === 'clear') return state.cleared;
  return state.score;
}

/** Display progress, clamped to [0, target]. */
export function goalProgress(goal: GoalSpec, state: GoalState): number {
  return Math.max(0, Math.min(goal.target, rawProgress(goal, state)));
}

export function goalDone(goal: GoalSpec, state: GoalState): boolean {
  return rawProgress(goal, state) >= goal.target;
}

export function goalsDone(goals: GoalSpec[], state: GoalState): boolean {
  return goals.length > 0 && goals.every((goal) => goalDone(goal, state));
}

interface DailyLike {
  kind: 'make' | 'clear' | 'score' | 'combined';
  target: number;
  level: number;
  extra: { kind: 'clear'; target: number } | null;
}
export function dailyGoalSpecs(daily: DailyLike): GoalSpec[] {
  if (daily.kind === 'combined') {
    return [
      { kind: 'make', target: daily.target, level: daily.level },
      { kind: 'clear', target: daily.extra?.target ?? 0 },
    ];
  }
  return [{ kind: daily.kind, target: daily.target, ...(daily.kind === 'make' ? { level: daily.level } : {}) }];
}
