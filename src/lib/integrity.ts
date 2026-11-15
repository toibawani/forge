/**
 * Attempt integrity.
 *
 * The value of a practice record collapses if answers can be copied, or typed
 * faster than a person can write. This module produces *signals*, not verdicts:
 * a flag records something unusual about the submission, and a human decides
 * whether it matters. Nothing here rejects an attempt — a false accusation is
 * worse than a missed flag on a practice product, and a flagged attempt is still
 * an honest record of what was submitted.
 *
 * Pure functions, so the rules are testable without a database.
 */

export type IntegrityFlag =
  | "implausibly_fast"
  | "too_fast_for_length"
  | "duplicate_answer";

export type IntegrityReport = {
  version: "integrity-v1";
  flags: IntegrityFlag[];
  wordRate: number | null;
  duplicate: { flagged: boolean; score: number; matchId: string | null };
  notes: string[];
};

export type ComparableAttempt = { id: string; answer: string };

/** Above this words-per-minute for a considered written answer, suspicion is fair. */
export const MAX_PLAUSIBLE_WPM = 100;

/** A long answer in seconds is possible by pasting, which is worth knowing about. */
export const SUSPICIOUS_MIN_SECONDS = 20;
export const SUSPICIOUS_MIN_WORDS = 30;

/** Near-identical wording across two attempts. */
export const DUPLICATE_THRESHOLD = 0.9;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`'"“”‘’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function bigrams(list: string[]): Set<string> {
  const grams = new Set<string>();
  for (let index = 0; index < list.length - 1; index += 1) {
    grams.add(`${list[index]} ${list[index + 1]}`);
  }
  return grams;
}

/**
 * Word-bigram Jaccard similarity, 0..1.
 *
 * Bigrams rather than single words: "the query is slow" and "the cache is slow"
 * share most of their vocabulary but not their meaning, and unigram overlap
 * would call them near-identical.
 */
function gramSets(a: string, b: string): { left: Set<string>; right: Set<string>; shared: number } {
  const left = bigrams(tokens(a));
  const right = bigrams(tokens(b));
  let shared = 0;
  for (const gram of left) {
    if (right.has(gram)) shared += 1;
  }
  return { left, right, shared };
}

export function similarity(a: string, b: string): number {
  const leftTokens = tokens(a);
  const rightTokens = tokens(b);

  if (bigrams(leftTokens).size === 0 || bigrams(rightTokens).size === 0) {
    // Very short answers have no bigrams; fall back to exact-token overlap.
    if (leftTokens.length === 0 || rightTokens.length === 0) return 0;
    const shared = leftTokens.filter((token) => rightTokens.includes(token)).length;
    return shared / Math.max(leftTokens.length, rightTokens.length);
  }

  const { left, right, shared } = gramSets(a, b);
  return shared / (left.size + right.size - shared);
}

/**
 * How much of the smaller answer appears in the larger one, 0..1.
 *
 * Jaccard alone misses the most common copy: someone pastes a good answer and
 * appends a line of their own, which dilutes the ratio even though the work is
 * not theirs. Containment catches that; the length guard in `duplicateRisk`
 * stops a short answer that happens to appear inside a long one from counting.
 */
export function containment(a: string, b: string): number {
  const { left, right, shared } = gramSets(a, b);
  const smaller = Math.min(left.size, right.size);
  if (smaller === 0) return 0;
  return shared / smaller;
}

function gramCount(text: string): number {
  return bigrams(tokens(text)).size;
}

/** Below this many bigrams, containment is too easy to trigger by accident. */
const CONTAINMENT_MIN_GRAMS = 20;

export function duplicateRisk(
  answer: string,
  others: ComparableAttempt[]
): { flagged: boolean; score: number; matchId: string | null } {
  let best = { flagged: false, score: 0, matchId: null as string | null };

  for (const other of others) {
    if (other.answer.trim().length === 0) continue;

    const jaccard = similarity(answer, other.answer);
    const contained = containment(answer, other.answer);
    const longEnough = Math.min(gramCount(answer), gramCount(other.answer)) >= CONTAINMENT_MIN_GRAMS;

    // 0.96 rather than 1.0: a fully contained answer is strong evidence, but
    // near-total containment of a long text is not proof of anything on its own.
    const score = longEnough ? Math.max(jaccard, contained * 0.96) : jaccard;

    if (score > best.score) {
      best = { flagged: score >= DUPLICATE_THRESHOLD, score, matchId: other.id };
    }
  }

  return best;
}

export function assessAttempt({
  answer,
  seconds,
  others = [],
}: {
  answer: string;
  seconds: number | null;
  others?: ComparableAttempt[];
}): IntegrityReport {
  const words = answer.trim() ? answer.trim().split(/\s+/).filter(Boolean).length : 0;
  const flags: IntegrityFlag[] = [];
  const notes: string[] = [];

  const wordRate =
    seconds && seconds > 0 && words > 0 ? Math.round((words / seconds) * 60) : null;

  if (wordRate !== null && wordRate > MAX_PLAUSIBLE_WPM) {
    flags.push("implausibly_fast");
    notes.push(`${wordRate} words per minute is faster than sustained human writing.`);
  }

  if (
    seconds !== null &&
    seconds < SUSPICIOUS_MIN_SECONDS &&
    words >= SUSPICIOUS_MIN_WORDS
  ) {
    flags.push("too_fast_for_length");
    notes.push(`${words} words in ${seconds} seconds suggests the text was not composed here.`);
  }

  const duplicate = duplicateRisk(answer, others);
  if (duplicate.flagged) {
    flags.push("duplicate_answer");
    notes.push("This answer is near-identical to another recorded attempt.");
  }

  return {
    version: "integrity-v1",
    flags: Array.from(new Set(flags)),
    wordRate,
    duplicate,
    notes,
  };
}

/** Human-readable line for a reviewer, or null when nothing was unusual. */
export function integritySummary(report: IntegrityReport | null | undefined): string | null {
  if (!report || report.flags.length === 0) return null;
  return report.notes.join(" ");
}
