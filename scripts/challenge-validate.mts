/**
 * `npm run challenge:validate` — the gate before anything is published.
 *
 * Checks the schema, the track rules, cross-file uniqueness, and (with `--run`)
 * executes every reference solution against its own tests through the sandbox.
 * Without `--run` it is still a real check: it proves the catalogue is
 * structurally publishable, which is what a content edit most often breaks.
 */

import { readFileSync, readdirSync } from "node:fs";

import { challengeSchema, validateAgainstTrack, type Challenge } from "../src/lib/challenge-model.ts";
import { tracksSchema, validateTracks, type Track } from "../src/lib/tracks.ts";
import { gradeInSandbox } from "../src/lib/judge0-client.ts";

const runReferences = process.argv.includes("--run");

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
}

const tracks = tracksSchema.parse(loadJson<Track[]>("../content/tracks.json"));
const trackProblems = validateTracks(tracks);

const challengeDir = new URL("../content/challenges/", import.meta.url);
const files = readdirSync(challengeDir).filter((name) => name.endsWith(".json"));

const challenges: Challenge[] = [];
const problems: string[] = [...trackProblems.map((problem) => `track: ${problem}`)];

for (const file of files) {
  const rows = loadJson<unknown[]>(`../content/challenges/${file}`);

  rows.forEach((row, index) => {
    const parsed = challengeSchema.safeParse(row);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${file}[${index}] ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      return;
    }

    for (const issue of validateAgainstTrack(parsed.data, tracks)) {
      problems.push(`${issue.slug}: ${issue.problem}`);
    }

    challenges.push(parsed.data);
  });
}

const seen = new Set<string>();
for (const challenge of challenges) {
  if (seen.has(challenge.slug)) problems.push(`${challenge.slug}: slug appears twice`);
  seen.add(challenge.slug);
}

if (runReferences) {
  if (!process.env.JUDGE0_URL) {
    console.error("--run needs JUDGE0_URL. Set it, or run without --run for structural checks.");
    process.exitCode = 1;
  } else {
    for (const challenge of challenges) {
      if (!challenge.language || challenge.tests.length === 0) continue;

      const grade = await gradeInSandbox({
        language: challenge.language,
        source: challenge.reference.body,
        tests: challenge.tests,
        timeLimitSeconds: challenge.timeLimitSeconds,
        elapsedSeconds: 0,
      });

      if (!grade.passedAll) {
        problems.push(
          `${challenge.slug}: reference solution failed ${grade.failures
            .map((failure) => failure.category)
            .join(", ")}`
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`challenge:validate found ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  const byTrack = new Map<string, number>();
  for (const challenge of challenges) {
    byTrack.set(challenge.track, (byTrack.get(challenge.track) ?? 0) + 1);
  }

  console.log(
    `challenge:validate ok — ${challenges.length} challenge(s) across ${tracks.length} track(s): ` +
      [...byTrack].map(([track, count]) => `${track} ${count}`).join(", ")
  );
  if (!runReferences) {
    console.log("Reference solutions were not executed (pass --run with JUDGE0_URL).");
  }
}
