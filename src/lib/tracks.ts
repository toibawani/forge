import { z } from "zod";

/**
 * Tracks are data, not code.
 *
 * `content/tracks.json` is the checked-in source, validated by this schema and
 * loaded into the `tracks` table by `scripts/seed-tracks.mts`. Adding a track
 * means adding a JSON entry (and, if it grades differently, an adapter) — not
 * editing an enum and every switch that reads it.
 */

export const CHALLENGE_FORMATS = [
  "code",
  "spot-the-bug",
  "predict-the-output",
  "fix-the-query",
  "rewrite",
  "short-answer",
] as const;

export type ChallengeFormat = (typeof CHALLENGE_FORMATS)[number];

/** Formats graded by executing code or SQL in the sandbox. */
export const SANDBOX_FORMATS: readonly ChallengeFormat[] = [
  "code",
  "spot-the-bug",
  "predict-the-output",
  "fix-the-query",
];

/** Formats graded by rubric against a submission. */
export const RUBRIC_FORMATS: readonly ChallengeFormat[] = ["rewrite", "short-answer"];

export const subSkillSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "sub-skill ids are lowercase words separated by hyphens"),
  label: z.string().trim().min(2).max(60),
});

export const trackSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "track ids are lowercase words separated by hyphens"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(20).max(400),
  formats: z.array(z.enum(CHALLENGE_FORMATS)).min(1),
  languages: z.array(z.string().trim().min(2).max(40)),
  grading: z.enum(["sandbox", "llm"]),
  subSkills: z.array(subSkillSchema).min(1).max(40),
});

export type Track = z.infer<typeof trackSchema>;
export type TrackInput = z.input<typeof trackSchema>;

export const tracksSchema = z.array(trackSchema).min(1);

/**
 * Cross-field rules the object schema cannot express: a sandbox track needs a
 * language to run, an LLM track must not claim one, and a grading mode has to
 * match the formats it claims to support.
 */
export function validateTracks(tracks: Track[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const track of tracks) {
    if (seen.has(track.id)) problems.push(`track "${track.id}" is defined twice`);
    seen.add(track.id);

    if (track.grading === "sandbox" && track.languages.length === 0) {
      problems.push(`track "${track.id}" is sandbox-graded but lists no language`);
    }

    if (track.grading === "llm" && track.languages.length > 0) {
      problems.push(`track "${track.id}" is rubric-graded but lists languages`);
    }

    for (const format of track.formats) {
      const expected = RUBRIC_FORMATS.includes(format) ? "llm" : "sandbox";
      if (track.grading !== expected) {
        problems.push(`track "${track.id}" format "${format}" is ${expected}-graded, track is ${track.grading}`);
      }
    }
  }

  return problems;
}

export function findTrack(tracks: Track[], id: string): Track | null {
  return tracks.find((track) => track.id === id) ?? null;
}

export function subSkillsOf(tracks: Track[], trackId: string): string[] {
  return findTrack(tracks, trackId)?.subSkills.map((skill) => skill.id) ?? [];
}
