/**
 * Comparing a submission with the reference answer.
 *
 * No model, no "similarity score" pretending to be insight. Two things a person
 * can act on:
 *
 *   * specifics the reference contains and their answer does not — a number, a
 *     named function, a file path, a command;
 *   * reference points with no counterpart in the answer, judged by sentence
 *     overlap rather than by exact wording.
 *
 * Deliberately conservative: the reference is one good answer, not the only one,
 * so the copy says "the reference mentions" rather than "you missed".
 */

export type AnswerComparison = {
  referenceSentences: number;
  sharedSentences: number;
  /** Share of reference sentences with a counterpart in the answer, 0-100. */
  overlapPercent: number;
  /** Concrete tokens present in the reference and absent from the answer. */
  missingSpecifics: string[];
  /** Reference sentences the answer does not cover, in reference order. */
  unmatchedReference: string[];
};

const MAX_SPECIFICS = 6;
const MAX_UNMATCHED = 4;
const SHARED_THRESHOLD = 0.34;

const STOP_WORDS = new Set([
  "the", "and", "that", "with", "this", "from", "have", "will", "your", "into",
  "then", "than", "they", "them", "their", "there", "which", "would", "should",
  "about", "because", "when", "what", "where", "while", "only", "also", "just",
]);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'_-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function overlapRatio(left: string, right: string): number {
  const leftWords = new Set(words(left));
  const rightWords = new Set(words(right));
  if (leftWords.size === 0 || rightWords.size === 0) return 0;

  let shared = 0;
  for (const word of leftWords) if (rightWords.has(word)) shared += 1;
  return shared / Math.min(leftWords.size, rightWords.size);
}

/** Numbers, code spans, identifiers and paths: the things a thin answer omits. */
export function extractSpecifics(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /`[^`\n]+`/g,
    /\b\d+(?:[.,]\d+)?\s?(?:%|ms|s|kb|mb|gb|x)?\b/gi,
    /\b[a-z]+(?:_[a-z0-9]+)+\b/g,
    /\b[a-z]+[A-Z][A-Za-z0-9]*\b/g,
    /\b[\w.-]+\/[\w./-]+\b/g,
    /\b[A-Z]{2,}\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.match(pattern) ?? []) {
      const value = match.trim().replace(/^`|`$/g, "");
      // Bare one- or two-digit numbers are usually ordinals or list markers.
      if (/^\d{1,2}$/.test(value)) continue;
      if (value.length < 2) continue;
      if (!found.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
        found.push(value);
      }
    }
  }

  return found.slice(0, MAX_SPECIFICS);
}

export function compareAnswer(answer: string, reference: string): AnswerComparison | null {
  const referenceText = reference.trim();
  if (referenceText.length === 0) return null;

  const referenceSentences = splitSentences(referenceText);
  const answerSentences = splitSentences(answer);

  const unmatchedReference = referenceSentences.filter((sentence) => {
    const best = answerSentences.reduce(
      (max, candidate) => Math.max(max, overlapRatio(sentence, candidate)),
      0
    );
    return best < SHARED_THRESHOLD;
  });

  const sharedSentences = referenceSentences.length - unmatchedReference.length;
  const overlapPercent =
    referenceSentences.length === 0
      ? 0
      : Math.round((sharedSentences / referenceSentences.length) * 100);

  const answerLower = answer.toLowerCase();
  const missingSpecifics = extractSpecifics(referenceText).filter(
    (specific) => !answerLower.includes(specific.toLowerCase())
  );

  return {
    referenceSentences: referenceSentences.length,
    sharedSentences,
    overlapPercent,
    missingSpecifics,
    unmatchedReference: unmatchedReference.slice(0, MAX_UNMATCHED),
  };
}

export type LeverageFix = {
  title: string;
  detail: string;
};

/**
 * One thing to change, chosen by the weakest measured dimension. Falls back to
 * the feedback's focus line when there are no grader dimensions to rank.
 */
export function highestLeverageFix(input: {
  dimensions?: Array<{ id: string; label?: string; score: number; maxScore?: number }>;
  focus?: string | null;
}): LeverageFix | null {
  const ranked = (input.dimensions ?? [])
    .filter((dimension) => typeof dimension.maxScore === "number" && (dimension.maxScore as number) > 0)
    .map((dimension) => ({
      ...dimension,
      ratio: dimension.score / (dimension.maxScore as number),
    }))
    .sort((left, right) => left.ratio - right.ratio);

  if (ranked.length > 0) {
    const weakest = ranked[0];
    return {
      title: `Raise ${(weakest.label ?? weakest.id).toLowerCase()} first`,
      detail: `It scored ${weakest.score} of ${weakest.maxScore} here, the lowest of any dimension. Fixing it moves the total more than polishing the ones already above it.`,
    };
  }

  if (input.focus) {
    return { title: "The one thing to change", detail: input.focus };
  }

  return null;
}
