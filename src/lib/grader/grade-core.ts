import type { Challenge } from "../challenge-model.ts";

import { detectInjection } from "./injection.ts";
import {
  GRADER_VERSION,
  RUBRIC_VERSION,
  buildGraderSystemPrompt,
  buildGraderUserPrompt,
} from "./prompt.ts";
import { parseGraderOutput, type GraderOutput } from "./schema.ts";

/**
 * Rubric grading, with the model call injected.
 *
 * The orchestration is the part worth testing: two independent samples, a third
 * only when they disagree by more than one point, a median per dimension, and
 * evidence that has to exist in the submission. Injecting the model call means
 * all of that is asserted without a key, a network or a bill.
 */

export type ModelCall = (input: { system: string; user: string; model: string }) => Promise<string>;

export type DimensionGrade = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  evidence: string;
  /** False when the quoted evidence is not actually in the submission. */
  evidenceVerified: boolean;
};

export type RubricGrade = {
  score: number;
  dimensions: DimensionGrade[];
  samples: number;
  model: string;
  graderVersion: string;
  rubricVersion: string;
  flags: string[];
};

const SAMPLE_COUNT = 2;

/** Whitespace and quote-style differences should not fail an honest quote. */
export function normaliseForQuote(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function evidenceAppearsInSubmission(evidence: string, answer: string): boolean {
  const quote = normaliseForQuote(evidence);
  if (quote.length < 3) return false;
  return normaliseForQuote(answer).includes(quote);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Combines per-sample dimension scores. Exported because the disagreement rule
 * is the part most likely to be changed by someone who is not reading this file.
 */
export function combineSamples(
  samples: GraderOutput[]
): { scores: Map<string, number>; disagreed: boolean } {
  const byId = new Map<string, number[]>();

  for (const sample of samples) {
    for (const dimension of sample.dimensions) {
      byId.set(dimension.id, [...(byId.get(dimension.id) ?? []), dimension.score]);
    }
  }

  const scores = new Map<string, number>();
  let disagreed = false;

  for (const [id, values] of byId) {
    if (Math.max(...values) - Math.min(...values) > 1) disagreed = true;
    scores.set(id, median(values));
  }

  return { scores, disagreed };
}

/** Weighted mean over dimensions, scaled to 0-100. */
export function dimensionScoreToTotal(
  challenge: Challenge,
  scores: Map<string, number>
): number {
  const dimensions = challenge.rubric?.dimensions ?? [];
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (dimensions.length === 0 || totalWeight === 0) return 0;

  const weighted = dimensions.reduce(
    (sum, dimension) => sum + (scores.get(dimension.id) ?? 0) * dimension.weight,
    0
  );

  return Math.round((weighted / (totalWeight * 4)) * 100);
}

async function sampleOnce(input: {
  challenge: Challenge;
  answer: string;
  model: string;
  callModel: ModelCall;
  attempt?: number;
}): Promise<GraderOutput | null> {
  const system = buildGraderSystemPrompt();
  const user = buildGraderUserPrompt(input.challenge, input.answer);

  // One retry for malformed output: a stray sentence around valid JSON is a
  // transport problem, not a verdict about the writer.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await input.callModel({ system, user, model: input.model });
      const parsed = parseGraderOutput(raw);
      if (parsed) return parsed;
    } catch {
      // Retried once, then treated as unavailable by the caller.
    }
  }

  return null;
}

export async function gradeRubric(input: {
  challenge: Challenge;
  answer: string;
  model: string;
  callModel: ModelCall;
}): Promise<RubricGrade | { error: string }> {
  const rubric = input.challenge.rubric;
  if (!rubric) return { error: "challenge_has_no_rubric" };

  const injection = detectInjection(input.answer);
  const flags: string[] = [];
  if (injection.suspicious) flags.push(`injection_suspected:${injection.matches.join(",")}`);

  const samples: GraderOutput[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const sample = await sampleOnce({ ...input, attempt: index });
    if (sample) samples.push(sample);
  }

  if (samples.length < SAMPLE_COUNT) {
    return { error: "grader_unavailable" };
  }

  let combined = combineSamples(samples);

  // Only pay for a third sample when the first two genuinely disagree.
  if (combined.disagreed) {
    const third = await sampleOnce({ ...input, attempt: 2 });
    if (third) {
      samples.push(third);
      combined = combineSamples(samples);
      if (combined.disagreed) flags.push("grader_disagreement");
    }
  }

  const dimensions: DimensionGrade[] = rubric.dimensions.map((dimension) => {
    const evidence =
      samples
        .map((sample) => sample.dimensions.find((entry) => entry.id === dimension.id)?.evidence ?? "")
        .find((quote) => evidenceAppearsInSubmission(quote, input.answer)) ?? "";

    const verified = evidence.length > 0;
    if (!verified) flags.push(`unverified_evidence:${dimension.id}`);

    return {
      id: dimension.id,
      label: dimension.label,
      score: verified ? (combined.scores.get(dimension.id) ?? 0) : 0,
      maxScore: dimension.maxScore,
      evidence,
      evidenceVerified: verified,
    };
  });

  const finalScores = new Map(dimensions.map((dimension) => [dimension.id, dimension.score]));

  return {
    score: dimensionScoreToTotal(input.challenge, finalScores),
    dimensions,
    samples: samples.length,
    model: input.model,
    graderVersion: GRADER_VERSION,
    rubricVersion: RUBRIC_VERSION,
    flags,
  };
}
