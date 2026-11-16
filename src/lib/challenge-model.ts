import { z } from "zod";

import {
  CHALLENGE_FORMATS,
  RUBRIC_FORMATS,
  type ChallengeFormat,
  type Track,
} from "./tracks.ts";

/**
 * The challenge record.
 *
 * Two rules shape it:
 *
 *   * Hidden tests and reference solutions live in the same document but are
 *     stripped before anything reaches the client. The field is called
 *     `hidden` on purpose, so a serializer that forgets is obvious in review.
 *   * An attempt pins `(challenge_slug, version)`. Editing a published
 *     challenge is a new version, never an edit in place, so a score keeps
 *     meaning what it meant when it was earned.
 */

export const testCaseSchema = z.object({
  /** Category is what feedback may name. It never reveals the input. */
  category: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(80),
  stdin: z.string().max(20_000).default(""),
  expectedStdout: z.string().max(20_000),
  hidden: z.boolean().default(true),
});

export const rubricDimensionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "dimension ids are lowercase words separated by hyphens"),
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20).max(600),
  weight: z.number().min(0).max(10).default(1),
  /** 0-4 scale, so a weight of 1 across four dimensions is a clean 100. */
  maxScore: z.literal(4).default(4),
});

export const referenceSchema = z.object({
  kind: z.enum(["solution", "answer"]),
  body: z.string().trim().min(10).max(20_000),
  notes: z.string().trim().max(600).optional(),
});

const base = {
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slugs are lowercase words separated by hyphens"),
  track: z.string().trim().min(2).max(32),
  title: z.string().trim().min(6).max(120),
  prompt: z.string().trim().min(40).max(4_000),
  /** Extra context shown before the answer box: input data, a failing query, a draft. */
  given: z.string().max(8_000).optional(),
  constraints: z.array(z.string().trim().min(3).max(160)).max(8).default([]),
  timeLimitSeconds: z.number().int().min(60).max(3_600),
  estimatedMinutes: z.number().int().min(1).max(60),
  subSkills: z.array(z.string().trim().min(2).max(40)).min(1).max(4),
  /** Glicko-2 rating a new challenge starts at. Recalibrated from real attempts. */
  initialRating: z.number().min(600).max(2_400).default(1_500),
  version: z.number().int().min(1).default(1),
  status: z.enum(["draft", "published", "retired"]).default("draft"),
  /** A retry serves this challenge's variant, not the same prompt again. */
  variantOf: z.string().trim().max(80).optional(),
  reference: referenceSchema,
} as const;

export const challengeSchema = z
  .object({
    ...base,
    format: z.enum(CHALLENGE_FORMATS),
    language: z.string().trim().min(2).max(40).optional(),
    tests: z.array(testCaseSchema).max(40).default([]),
    rubric: z
      .object({
        minWords: z.number().int().min(10).max(2_000).default(40),
        dimensions: z.array(rubricDimensionSchema).min(3).max(5),
      })
      .optional(),
  })
  .superRefine((challenge, ctx) => {
    const rubricGraded = RUBRIC_FORMATS.includes(challenge.format);

    if (rubricGraded) {
      if (!challenge.rubric) {
        ctx.addIssue({
          code: "custom",
          path: ["rubric"],
          message: "rubric-graded formats need a rubric of 3 to 5 dimensions",
        });
      }
      if (challenge.tests.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["tests"],
          message: "rubric-graded formats must not carry executable tests",
        });
      }
      if (challenge.reference.kind !== "answer") {
        ctx.addIssue({
          code: "custom",
          path: ["reference", "kind"],
          message: "rubric-graded challenges need a reference answer",
        });
      }
      return;
    }

    if (challenge.tests.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["tests"],
        message: "graded-by-tests formats need at least two test cases",
      });
    }
    if (challenge.tests.filter((test) => test.hidden).length < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["tests"],
        message: "at least one test must be hidden, or the answer can be timed to the tests",
      });
    }
    if (challenge.reference.kind !== "solution") {
      ctx.addIssue({
        code: "custom",
        path: ["reference", "kind"],
        message: "sandbox-graded challenges need a reference solution",
      });
    }
    if (!challenge.language) {
      ctx.addIssue({
        code: "custom",
        path: ["language"],
        message: "sandbox-graded challenges must name a language",
      });
    }
  });

export type Challenge = z.infer<typeof challengeSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type RubricDimension = z.infer<typeof rubricDimensionSchema>;

export type ChallengeProblem = { slug: string; problem: string };

/**
 * Rules that need the track registry, which the schema deliberately does not
 * import: the model describes one challenge, the catalogue describes the set.
 */
export function validateAgainstTrack(challenge: Challenge, tracks: Track[]): ChallengeProblem[] {
  const track = tracks.find((candidate) => candidate.id === challenge.track);
  if (!track) return [{ slug: challenge.slug, problem: `unknown track "${challenge.track}"` }];

  const problems: ChallengeProblem[] = [];

  if (!track.formats.includes(challenge.format)) {
    problems.push({ slug: challenge.slug, problem: `format "${challenge.format}" is not allowed in ${track.id}` });
  }

  if (challenge.language && !track.languages.includes(challenge.language)) {
    problems.push({ slug: challenge.slug, problem: `language "${challenge.language}" is not offered in ${track.id}` });
  }

  const known = new Set(track.subSkills.map((skill) => skill.id));
  for (const subSkill of challenge.subSkills) {
    if (!known.has(subSkill)) {
      problems.push({ slug: challenge.slug, problem: `unknown sub-skill "${subSkill}" for ${track.id}` });
    }
  }

  return problems;
}

/**
 * The document a client may see. Tests are reduced to their categories and the
 * reference solution is removed entirely.
 */
export function publicChallenge(challenge: Challenge) {
  return {
    slug: challenge.slug,
    track: challenge.track,
    format: challenge.format,
    title: challenge.title,
    prompt: challenge.prompt,
    given: challenge.given,
    constraints: challenge.constraints,
    timeLimitSeconds: challenge.timeLimitSeconds,
    estimatedMinutes: challenge.estimatedMinutes,
    subSkills: challenge.subSkills,
    version: challenge.version,
    language: challenge.language,
    testCategories: Array.from(new Set(challenge.tests.map((test) => test.category))),
    rubric: challenge.rubric
      ? {
          minWords: challenge.rubric.minWords,
          dimensions: challenge.rubric.dimensions.map((dimension) => ({
            id: dimension.id,
            label: dimension.label,
            description: dimension.description,
          })),
        }
      : null,
  };
}

/** A published challenge is the only kind that may appear in the app. */
export function isPublished(challenge: Challenge): boolean {
  return challenge.status === "published";
}

export function formatNeedsSandbox(format: ChallengeFormat): boolean {
  return !RUBRIC_FORMATS.includes(format);
}
