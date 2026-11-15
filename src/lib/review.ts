/**
 * Human review.
 *
 * A rubric can see whether an answer is structured and specific; it cannot see
 * whether it is right. These helpers describe human verdicts and measure how
 * often the rubric agrees with them, so the recruiter-facing claim can be
 * calibrated rather than asserted.
 */

export type Verdict = "correct" | "partially_correct" | "incorrect";

export const VERDICTS: Array<{
  value: Verdict;
  label: string;
  hint: string;
  tone: "success" | "warning" | "error";
}> = [
  {
    value: "correct",
    label: "Correct",
    hint: "The answer solves the problem and the reasoning holds up.",
    tone: "success",
  },
  {
    value: "partially_correct",
    label: "Partly correct",
    hint: "The direction is right, but something material is wrong or missing.",
    tone: "warning",
  },
  {
    value: "incorrect",
    label: "Incorrect",
    hint: "The answer does not solve the problem, however well written it is.",
    tone: "error",
  },
];

export type ReviewCounts = {
  reviewed_attempts?: number | null;
  correct?: number | null;
  partially_correct?: number | null;
  incorrect?: number | null;
  last_reviewed_at?: string | null;
};

export type ReviewSummary = {
  reviewed: number;
  correct: number;
  partiallyCorrect: number;
  incorrect: number;
  verified: boolean;
  text: string;
  tone: "success" | "warning" | "error" | "none";
};

export function verdictLabel(verdict: string | null | undefined): string {
  return VERDICTS.find((entry) => entry.value === verdict)?.label ?? "Not reviewed";
}

export function verdictTone(
  verdict: string | null | undefined
): "success" | "warning" | "error" | "none" {
  return VERDICTS.find((entry) => entry.value === verdict)?.tone ?? "none";
}

/**
 * Turns review counts into one sentence a recruiter can read.
 *
 * The wording never hides a bad review behind an average: if nothing was judged
 * correct, the summary says so.
 */
export function reviewSummary(counts: ReviewCounts | null | undefined): ReviewSummary {
  const reviewed = Number(counts?.reviewed_attempts ?? 0);
  const correct = Number(counts?.correct ?? 0);
  const partiallyCorrect = Number(counts?.partially_correct ?? 0);
  const incorrect = Number(counts?.incorrect ?? 0);

  if (reviewed <= 0) {
    return {
      reviewed: 0,
      correct: 0,
      partiallyCorrect: 0,
      incorrect: 0,
      verified: false,
      text: "No human review yet",
      tone: "none",
    };
  }

  const tone: ReviewSummary["tone"] = incorrect > 0 ? "error" : partiallyCorrect > 0 ? "warning" : "success";
  const parts = [
    correct > 0 ? `${correct} correct` : null,
    partiallyCorrect > 0 ? `${partiallyCorrect} partly correct` : null,
    incorrect > 0 ? `${incorrect} incorrect` : null,
  ].filter(Boolean);

  return {
    reviewed,
    correct,
    partiallyCorrect,
    incorrect,
    verified: true,
    text: `${reviewed} reviewed: ${parts.join(", ")}`,
    tone,
  };
}

export type CalibrationPair = { rubricScore: number; verdict: Verdict };

/** What the rubric alone would have said, so it can be compared to a person. */
export function rubricBand(rubricScore: number): Verdict {
  if (rubricScore >= 75) return "correct";
  if (rubricScore >= 50) return "partially_correct";
  return "incorrect";
}

export type Calibration = {
  total: number;
  /** null until there is at least one reviewed pair. */
  agreement: number | null;
  overrated: number;
  underrated: number;
};

/** Below this, agreement is treated as indicative rather than proven. */
export const CALIBRATION_MIN_SAMPLE = 20;

/**
 * How much weight the agreement number deserves.
 *
 * The failure mode here is quoting "100% agreement" off three reviews, so the
 * sample size is stated with the number rather than buried in a footnote.
 */
export function calibrationNote(total: number): { text: string; confident: boolean } {
  if (total === 0) {
    return { text: "No reviewed attempts yet, so agreement is unmeasured.", confident: false };
  }

  if (total < CALIBRATION_MIN_SAMPLE) {
    return {
      text: `Only ${total} reviewed attempt${total === 1 ? "" : "s"} — indicative, not proven.`,
      confident: false,
    };
  }

  return { text: `${total} reviewed attempts.`, confident: true };
}

/**
 * Agreement between the rubric band and the human verdict.
 *
 * Tracked in both directions: `overrated` is a badly written answer the rubric
 * liked, `underrated` is a good answer the rubric punished. Both are reasons to
 * change the rubric, not to hide the number.
 */
export function calibration(pairs: CalibrationPair[]): Calibration {
  // Only scored attempts can be compared: an unscored answer has no band.

  if (pairs.length === 0) {
    return { total: 0, agreement: null, overrated: 0, underrated: 0 };
  }

  let agree = 0;
  let overrated = 0;
  let underrated = 0;

  for (const pair of pairs) {
    const band = rubricBand(pair.rubricScore);
    if (band === pair.verdict) {
      agree += 1;
      continue;
    }

    const rank: Record<Verdict, number> = { incorrect: 0, partially_correct: 1, correct: 2 };
    if (rank[band] > rank[pair.verdict]) overrated += 1;
    else underrated += 1;
  }

  return {
    total: pairs.length,
    agreement: Math.round((agree / pairs.length) * 100),
    overrated,
    underrated,
  };
}
