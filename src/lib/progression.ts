/**
 * Skill progression.
 *
 * Levels are derived from real evidence — days practised and the quality of
 * recent work — never from time spent or clicks. There is no XP to farm and no
 * way to reach a level by repeating the easiest challenge: the average is
 * taken over your most recent scored attempts, so coasting decays it.
 *
 * Pure functions so the dashboard, the result page, the catalogue and the
 * recruiter-facing summaries all agree on the same number.
 */

export type LevelDefinition = {
  index: number;
  name: string;
  /** Distinct days with at least one logged attempt. */
  minDays: number;
  /** Average of the most recent scored attempts. */
  minAverage: number;
  description: string;
};

export const LEVELS: LevelDefinition[] = [
  {
    index: 0,
    name: "Foundations",
    minDays: 0,
    minAverage: 0,
    description: "Starting out. The first job is showing up.",
  },
  {
    index: 1,
    name: "Practising",
    minDays: 3,
    minAverage: 55,
    description: "A habit exists and the work is real.",
  },
  {
    index: 2,
    name: "Consistent",
    minDays: 8,
    minAverage: 65,
    description: "Regular practice with dependable quality.",
  },
  {
    index: 3,
    name: "Proficient",
    minDays: 16,
    minAverage: 75,
    description: "Sustained, specific work that holds up to review.",
  },
  {
    index: 4,
    name: "Proven",
    minDays: 30,
    minAverage: 82,
    description: "A long record of high-quality practice. Rare, and visible.",
  },
];

export type ScoredAttempt = {
  score: number | null;
  practice_date: string;
  created_at: string;
  category: string | null;
};

export type LevelProgress = {
  level: LevelDefinition;
  next: LevelDefinition | null;
  days: number;
  average: number | null;
  /** 0..100 toward the next level, limited by whichever requirement is behind. */
  percent: number;
  missingDays: number;
  missingAverage: number;
  requirement: string;
};

const RECENT_WINDOW = 10;

/** Average of the most recent scored attempts: coasting should cost you. */
export function recentAverage(attempts: ScoredAttempt[], window = RECENT_WINDOW): number | null {
  const scored = attempts
    .filter((attempt) => typeof attempt.score === "number")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, window);

  if (scored.length === 0) return null;
  return Math.round(scored.reduce((total, attempt) => total + (attempt.score ?? 0), 0) / scored.length);
}

export function distinctDays(attempts: ScoredAttempt[]): number {
  return new Set(attempts.map((attempt) => attempt.practice_date)).size;
}

export function progressFor(attempts: ScoredAttempt[]): LevelProgress {
  const days = distinctDays(attempts);
  const average = recentAverage(attempts);

  // Level is granted only when both requirements are met; a strong average on
  // two days is not a record.
  let current = LEVELS[0];
  for (const level of LEVELS) {
    const meetsDays = days >= level.minDays;
    const meetsAverage = average !== null && average >= level.minAverage;
    if (meetsDays && meetsAverage) current = level;
  }

  const next = LEVELS.find((level) => level.index === current.index + 1) ?? null;

  if (!next) {
    return {
      level: current,
      next: null,
      days,
      average,
      percent: 100,
      missingDays: 0,
      missingAverage: 0,
      requirement: "Top level reached. The work now is keeping it.",
    };
  }

  const dayRatio = next.minDays === 0 ? 1 : Math.min(1, days / next.minDays);
  const averageRatio =
    average === null ? 0 : Math.min(1, average / Math.max(1, next.minAverage));
  const percent = Math.round(Math.min(dayRatio, averageRatio) * 100);

  const missingDays = Math.max(0, next.minDays - days);
  const missingAverage = average === null ? next.minAverage : Math.max(0, next.minAverage - average);

  let requirement: string;
  if (missingDays > 0 && missingAverage > 0) {
    requirement = `${missingDays} more practice ${missingDays === 1 ? "day" : "days"} and ${missingAverage} points on your recent average.`;
  } else if (missingDays > 0) {
    requirement = `${missingDays} more practice ${missingDays === 1 ? "day" : "days"} at this quality.`;
  } else if (missingAverage > 0) {
    requirement = `${missingAverage} points on your recent average — the days are already there.`;
  } else {
    requirement = "One more session at this quality.";
  }

  return {
    level: current,
    next,
    days,
    average,
    percent,
    missingDays,
    missingAverage,
    requirement,
  };
}

const DIFFICULTY_BY_LEVEL = ["beginner", "beginner", "intermediate", "advanced", "advanced"] as const;

export function targetDifficulty(levelIndex: number): "beginner" | "intermediate" | "advanced" {
  return DIFFICULTY_BY_LEVEL[Math.max(0, Math.min(4, levelIndex))];
}

/** Consistency across a trailing window, plus the change against the window before it. */
export function consistencyTrend(
  attempts: ScoredAttempt[],
  days = 7
): { thisWindow: number; previousWindow: number; delta: number } {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const thisCutoff = now - days * dayMs;
  const previousCutoff = now - days * 2 * dayMs;

  const thisDays = new Set<string>();
  const previousDays = new Set<string>();

  for (const attempt of attempts) {
    const at = new Date(attempt.created_at).getTime();
    if (at >= thisCutoff) thisDays.add(attempt.practice_date);
    else if (at >= previousCutoff) previousDays.add(attempt.practice_date);
  }

  return {
    thisWindow: thisDays.size,
    previousWindow: previousDays.size,
    delta: thisDays.size - previousDays.size,
  };
}

/** Average of the newest attempts against the ones before them. */
export function scoreTrend(
  attempts: ScoredAttempt[],
  window = 5
): { recent: number | null; previous: number | null; delta: number | null } {
  const scored = attempts
    .filter((attempt) => typeof attempt.score === "number")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const average = (rows: ScoredAttempt[]) =>
    rows.length === 0
      ? null
      : Math.round(rows.reduce((total, row) => total + (row.score ?? 0), 0) / rows.length);

  const recent = average(scored.slice(0, window));
  const previous = average(scored.slice(window, window * 2));

  return {
    recent,
    previous,
    delta: recent !== null && previous !== null ? recent - previous : null,
  };
}

/** Milestones worth naming, because "streak" alone stops meaning anything. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

export function nextMilestone(streak: number): number | null {
  return STREAK_MILESTONES.find((milestone) => milestone > streak) ?? null;
}

/** Level progress per skill, keyed by category. */
export function levelsByCategory(attempts: ScoredAttempt[]): Map<string, LevelProgress> {
  const grouped = new Map<string, ScoredAttempt[]>();

  for (const attempt of attempts) {
    if (!attempt.category) continue;
    grouped.set(attempt.category, [...(grouped.get(attempt.category) ?? []), attempt]);
  }

  const result = new Map<string, LevelProgress>();
  for (const [category, rows] of grouped) {
    result.set(category, progressFor(rows));
  }
  return result;
}

/** Average score per skill, used to find the weakest area honestly. */
export function categoryAverages(attempts: ScoredAttempt[]): Map<string, { average: number; count: number }> {
  const grouped = new Map<string, number[]>();

  for (const attempt of attempts) {
    if (!attempt.category || typeof attempt.score !== "number") continue;
    grouped.set(attempt.category, [...(grouped.get(attempt.category) ?? []), attempt.score]);
  }

  const result = new Map<string, { average: number; count: number }>();
  for (const [category, scores] of grouped) {
    result.set(category, {
      average: Math.round(scores.reduce((total, score) => total + score, 0) / scores.length),
      count: scores.length,
    });
  }
  return result;
}
