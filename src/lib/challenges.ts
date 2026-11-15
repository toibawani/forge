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
