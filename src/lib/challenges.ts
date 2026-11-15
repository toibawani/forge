/**
 * Challenge presentation helpers shared by the practice runner, the result
 * page, the catalogue and the dashboard.
 *
 * Pure data and copy only: no server imports, so these can run anywhere.
 */

export type ChallengeContent = {
  language?: string;
  given?: string;
  prompt?: string;
  deliverable?: string;
  constraints?: string[];
  format?: string;
  input?: string;
  period?: string;
};

export type ChallengeRubric = {
  signals?: string[];
  min_words?: number;
};

export type Challenge = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  estimated_minutes: number;
  time_limit_seconds: number | null;
  content: ChallengeContent;
  rubric: ChallengeRubric;
};

export type ScoreBand = {
  label: string;
  className: string;
  summary: string;
};

/** Same bands the dashboard uses, so a score is described one way everywhere. */
export function scoreBand(score: number | null): ScoreBand {
  if (score === null) {
    return { label: "unscored", className: "text-muted", summary: "No score was recorded." };
  }
  if (score >= 85) {
    return {
      label: "strong",
      className: "text-success",
      summary: "Specific, structured and complete enough to stand as evidence.",
    };
  }
  if (score >= 70) {
    return {
      label: "solid",
      className: "text-foreground",
      summary: "The substance is there; tighten the structure or add specifics.",
    };
  }
  if (score >= 50) {
    return {
      label: "developing",
      className: "text-accent",
      summary: "The direction is right but the answer is thin on detail or evidence.",
    };
  }
  return {
    label: "needs work",
    className: "text-destructive",
    summary: "This one needs a second attempt with more concrete reasoning.",
  };
}

export function skillLabel(category: string): string {
  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseContent(value: unknown): ChallengeContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : undefined);
  const list = Array.isArray(record.constraints)
    ? (record.constraints as unknown[]).filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    language: text("language"),
    given: text("given"),
    prompt: text("prompt"),
    deliverable: text("deliverable"),
    constraints: list,
    format: text("format"),
    input: text("input"),
    period: text("period"),
  };
}

export function parseRubric(value: unknown): ChallengeRubric {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    signals: Array.isArray(record.signals)
      ? (record.signals as unknown[]).filter((item): item is string => typeof item === "string")
      : undefined,
    min_words: typeof record.min_words === "number" ? record.min_words : undefined,
  };
}

export const DIFFICULTY_ORDER: Record<Challenge["difficulty"], number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

type AttemptLite = {
  challenge_id: string;
  category?: string | null;
  practice_date: string;
  created_at: string;
};

/**
 * The skill to lead with: the one the user has practised most. Falls back to
 * the first category in the catalogue for a new account.
 */
export function primaryCategory(
  attempts: AttemptLite[],
  challenges: Challenge[]
): string | null {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    const category = attempt.category;
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0) return ranked[0][0];
  return challenges.length > 0 ? challenges[0].category : null;
}

/**
 * Deterministic recommendation: inside the preferred skill, pick the active
 * challenge attempted fewest times, breaking ties by difficulty. No hidden
 * ranking, and the same answer on the server and the client.
 */
export function recommendChallenge(
  challenges: Challenge[],
  attempts: AttemptLite[],
  preferredCategory?: string | null
): Challenge | null {
  if (challenges.length === 0) return null;

  const counts = new Map<string, number>();
  const lastPractised = new Map<string, string>();
  for (const attempt of attempts) {
    counts.set(attempt.challenge_id, (counts.get(attempt.challenge_id) ?? 0) + 1);
    const previous = lastPractised.get(attempt.challenge_id);
    if (!previous || attempt.created_at > previous) {
      lastPractised.set(attempt.challenge_id, attempt.created_at);
    }
  }

  const pool = preferredCategory
    ? challenges.filter((challenge) => challenge.category === preferredCategory)
    : challenges;
  const candidates = pool.length > 0 ? pool : challenges;

  return [...candidates].sort((a, b) => {
    const attemptsDiff = (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0);
    if (attemptsDiff !== 0) return attemptsDiff;

    const lastDiff = (lastPractised.get(a.id) ?? "").localeCompare(lastPractised.get(b.id) ?? "");
    if (lastDiff !== 0) return lastDiff;

    return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
  })[0];
}

export type SelectionAttempt = {
  challenge_id: string;
  category: string | null;
  score: number | null;
  practice_date: string;
  created_at: string;
};

export type Recommendation = {
  challenge: Challenge;
  reason: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Picks the next challenge with a stated reason.
 *
 * Order of concern: finish what you started (don't let one skill dominate), fix
 * the weakest area, then match difficulty to the level you actually earned. The
 * reason is shown in the UI — a recommendation nobody can explain is just a
 * billboard.
 */
export function recommendNext({
  challenges,
  attempts,
  now = Date.now(),
}: {
  challenges: Challenge[];
  attempts: SelectionAttempt[];
  now?: number;
}): Recommendation | null {
  if (challenges.length === 0) return null;

  const ordered = [...attempts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const categories = Array.from(new Set(challenges.map((challenge) => challenge.category)));

  const stats = new Map<string, { count: number; scores: number[]; lastAt: string }>();
  for (const attempt of ordered) {
    if (!attempt.category) continue;
    const entry = stats.get(attempt.category) ?? { count: 0, scores: [], lastAt: "" };
    entry.count += 1;
    if (typeof attempt.score === "number") entry.scores.push(attempt.score);
    if (!entry.lastAt) entry.lastAt = attempt.created_at;
    stats.set(attempt.category, entry);
  }

  const averageOf = (scores: number[]) =>
    scores.length === 0 ? null : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);

  const overallScores = ordered
    .map((attempt) => attempt.score)
    .filter((score): score is number => typeof score === "number");
  const overallAverage = averageOf(overallScores);

  // Rotation: two sessions in one skill in a row is a rut, not a record.
  const recentCategories = ordered.slice(0, 2).map((attempt) => attempt.category);
  const stuck =
    recentCategories.length === 2 &&
    recentCategories[0] !== null &&
    recentCategories[0] === recentCategories[1];

  let target = preferredCategoryOrNull(ordered, categories);
  let reason: string | null = null;

  if (stuck && categories.length > 1) {
    const alternatives = categories.filter((category) => category !== recentCategories[0]);
    target = weakestCategory(alternatives, stats, averageOf) ?? alternatives[0];
    reason = `Your last two sessions stayed in ${skillLabel(recentCategories[0] as string)}. Breadth across skills is part of the signal, so this moves you to ${skillLabel(target)}.`;
  } else {
    const weakest = weakestCategory(
      categories,
      stats,
      averageOf,
      overallAverage === null ? undefined : overallAverage - 5
    );

    if (weakest && weakest !== target) {
      const weakestAverage = averageOf(stats.get(weakest)?.scores ?? []);
      target = weakest;
      reason = `${skillLabel(weakest)} is your weakest area right now${
        weakestAverage === null ? "" : ` (average ${weakestAverage})`
      }. Improving the low end moves your whole record more than another strong session would.`;
    }
  }

  const category = target ?? categories[0];
  const inCategory = challenges.filter((challenge) => challenge.category === category);
  const pool = inCategory.length > 0 ? inCategory : challenges;

  const categoryAttempts = ordered.filter((attempt) => attempt.category === category);
  const level = levelIndexFor(categoryAttempts);
  const difficulty = targetDifficulty(level);

  const atLevel = pool.filter((challenge) => challenge.difficulty === difficulty);
  const candidates = atLevel.length > 0 ? atLevel : pool;

  const counts = new Map<string, number>();
  const lastSeen = new Map<string, string>();
  for (const attempt of ordered) {
    counts.set(attempt.challenge_id, (counts.get(attempt.challenge_id) ?? 0) + 1);
    if (!lastSeen.has(attempt.challenge_id)) lastSeen.set(attempt.challenge_id, attempt.created_at);
  }

  // Do not hand back a challenge attempted in the last week unless it is the
  // only thing at this level.
  const fresh = candidates.filter((challenge) => {
    const last = lastSeen.get(challenge.id);
    return !last || now - new Date(last).getTime() > 7 * DAY_MS;
  });
  const shortlist = fresh.length > 0 ? fresh : candidates;

  const challenge = [...shortlist].sort((a, b) => {
    const attemptDiff = (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0);
    if (attemptDiff !== 0) return attemptDiff;
    const lastDiff = (lastSeen.get(a.id) ?? "").localeCompare(lastSeen.get(b.id) ?? "");
    if (lastDiff !== 0) return lastDiff;
    return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
  })[0];

  return {
    challenge,
    reason:
      reason ??
      (categoryAttempts.length === 0
        ? `Begin with ${skillLabel(category)}. The first session sets your baseline, and the level you reach is earned from there.`
        : `${skillLabel(category)} at ${difficulty} level — where your record stands.`),
  };
}

function preferredCategoryOrNull(
  ordered: SelectionAttempt[],
  categories: string[]
): string | null {
  const counts = new Map<string, number>();
  for (const attempt of ordered) {
    if (!attempt.category) continue;
    counts.set(attempt.category, (counts.get(attempt.category) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0) return ranked[0][0];
  return categories[0] ?? null;
}

function weakestCategory(
  categories: string[],
  stats: Map<string, { count: number; scores: number[]; lastAt: string }>,
  averageOf: (scores: number[]) => number | null,
  threshold?: number
): string | null {
  let weakest: { category: string; average: number } | null = null;

  for (const category of categories) {
    const entry = stats.get(category);
    if (!entry || entry.scores.length < 2) continue;
    const average = averageOf(entry.scores);
    if (average === null) continue;
    if (!weakest || average < weakest.average) weakest = { category, average };
  }

  if (!weakest) return null;
  if (threshold !== undefined && weakest.average >= threshold) return null;
  return weakest.category;
}

/**
 * Level index used to choose difficulty.
 *
 * Exported so tests can prove it agrees with `progressFor` in progression.ts.
 * Selection and progression keep separate implementations because this module
 * must stay dependency-free (it renders on the client), but two answers to
 * "what level is this person" would be a product bug, not a style choice.
 */
export function levelIndexFor(attempts: SelectionAttempt[]): number {
  const days = new Set(attempts.map((attempt) => attempt.practice_date)).size;
  const recent = attempts
    .filter((attempt) => typeof attempt.score === "number")
    .slice(0, 10)
    .map((attempt) => attempt.score as number);
  const average = recent.length
    ? Math.round(recent.reduce((total, score) => total + score, 0) / recent.length)
    : null;

  let index = 0;
  const thresholds = [
    { days: 3, average: 55 },
    { days: 8, average: 65 },
    { days: 16, average: 75 },
    { days: 30, average: 82 },
  ];

  thresholds.forEach((threshold, position) => {
    if (days >= threshold.days && average !== null && average >= threshold.average) {
      index = position + 1;
    }
  });

  return index;
}

function targetDifficulty(levelIndex: number): "beginner" | "intermediate" | "advanced" {
  if (levelIndex <= 1) return "beginner";
  if (levelIndex === 2) return "intermediate";
  return "advanced";
}

export function minutesLabel(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function clockLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
