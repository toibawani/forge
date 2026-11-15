/**
 * Recruiter-facing presentation helpers.
 *
 * Pure and dependency-free so the search UI, the comparison page and the
 * public record all describe the same candidate the same way.
 *
 * What this module deliberately does NOT do: invent a "rating", a grade or an
 * overall match score. A recruiter sees counts, recency and rubric scores,
 * with the rubric's limits stated in the UI.
 */

export type SkillSignal = {
  category: string;
  total_attempts: number | null;
  attempts_30d: number | null;
  days_30d: number | null;
  avg_score_30d: number | null;
  avg_score_90d: number | null;
  best_score: number | null;
  strong_days_90d: number | null;
  last_attempt_at: string | null;
};

export type CandidateCard = {
  id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[] | null;
  visibility: string | null;
  current_streak: number;
  longest_streak: number;
  total_practice_days: number;
  last_practice_date: string | null;
};

export type Candidate = CandidateCard & {
  signals: SkillSignal[];
  recentActivityDays?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function recencyLabel(lastAttemptAt: string | null, now = Date.now()): string {
  if (!lastAttemptAt) return "No recorded practice";
  const at = new Date(lastAttemptAt).getTime();
  if (!Number.isFinite(at)) return "No recorded practice";

  const days = Math.floor((now - at) / DAY_MS);
  if (days <= 0) return "Practised today";
  if (days === 1) return "Practised yesterday";
  if (days < 7) return `Practised ${days} days ago`;
  if (days < 14) return "Practised last week";
  if (days < 45) return `Practised ${Math.round(days / 7)} weeks ago`;
  return "No practice in over a month";
}

export type ConsistencyTone = "strong" | "steady" | "thin" | "none";

export function consistencyLabel(days30: number): { label: string; tone: ConsistencyTone } {
  if (days30 >= 18) return { label: `${days30} of the last 30 days`, tone: "strong" };
  if (days30 >= 8) return { label: `${days30} days in the last 30`, tone: "steady" };
  if (days30 >= 1) return { label: `${days30} day${days30 === 1 ? "" : "s"} in the last 30`, tone: "thin" };
  return { label: "No practice in 30 days", tone: "none" };
}

/** The skill with the strongest 90-day average, used as a "where they are strongest" line. */
export function strongestSignal(signals: SkillSignal[]): SkillSignal | null {
  let best: SkillSignal | null = null;
  for (const signal of signals) {
    const score = signal.avg_score_90d;
    if (typeof score !== "number") continue;
    if (!best || score > (best.avg_score_90d ?? -1)) best = signal;
  }
  return best;
}

export function totalDays30(signals: SkillSignal[]): number {
  return signals.reduce((total, signal) => total + Number(signal.days_30d ?? 0), 0);
}

export function lastActivityAt(signals: SkillSignal[]): string | null {
  let latest: number | null = null;
  let iso: string | null = null;
  for (const signal of signals) {
    if (!signal.last_attempt_at) continue;
    const at = new Date(signal.last_attempt_at).getTime();
    if (!Number.isFinite(at)) continue;
    if (latest === null || at > latest) {
      latest = at;
      iso = signal.last_attempt_at;
    }
  }
  return iso;
}

export type CandidateSummary = {
  name: string;
  activity: string;
  consistency: { label: string; tone: ConsistencyTone };
  days30: number;
  strongestCategory: string | null;
  strongestScore: number | null;
  lastActiveDays: number | null;
};

export function summariseCandidate(candidate: Candidate, now = Date.now()): CandidateSummary {
  const signals = candidate.signals ?? [];
  const strongest = strongestSignal(signals);
  const lastAt = lastActivityAt(signals) ?? candidate.last_practice_date;

  let lastActiveDays: number | null = null;
  if (lastAt) {
    const at = new Date(lastAt).getTime();
    if (Number.isFinite(at)) lastActiveDays = Math.max(0, Math.floor((now - at) / DAY_MS));
  }

  return {
    name: candidate.display_name?.trim() || "Forge practitioner",
    activity: recencyLabel(lastActivityAt(signals), now),
    consistency: consistencyLabel(totalDays30(signals)),
    days30: totalDays30(signals),
    strongestCategory: strongest?.category ?? null,
    strongestScore: strongest?.avg_score_90d ?? null,
    lastActiveDays,
  };
}

/**
 * Ranking used by the dashboard: people currently practising first, then
 * volume of recent practice, then streak. A long streak that ended months ago
 * should not outrank someone practising this week.
 */
export function sortCandidates(candidates: Candidate[], now = Date.now()): Candidate[] {
  return [...candidates].sort((a, b) => {
    const aSummary = summariseCandidate(a, now);
    const bSummary = summariseCandidate(b, now);

    const aDays = aSummary.lastActiveDays ?? Number.POSITIVE_INFINITY;
    const bDays = bSummary.lastActiveDays ?? Number.POSITIVE_INFINITY;

    const aFresh = aDays <= 7;
    const bFresh = bDays <= 7;
    if (aFresh !== bFresh) return aFresh ? -1 : 1;

    if (bSummary.days30 !== aSummary.days30) return bSummary.days30 - aSummary.days30;
    if (b.current_streak !== a.current_streak) return b.current_streak - a.current_streak;
    return b.total_practice_days - a.total_practice_days;
  });
}

/** True where the record supports a claim of verified practice. No reviews, no badge. */
export function hasHumanReview(reviews: number | null | undefined): boolean {
  return typeof reviews === "number" && reviews > 0;
}
