/**
 * `npm run challenge:calibrate` — does the grader still agree with us?
 *
 * Each anchor is an answer with a known acceptable score range. If the grader
 * moves an anchor outside its range, the rubric, the prompt or the model has
 * drifted and grades are not comparable with earlier ones. This fails loudly;
 * it does not adjust the ranges.
 */

import { readFileSync, readdirSync } from "node:fs";

import { challengeSchema, type Challenge } from "../src/lib/challenge-model.ts";
import { gradeRubric } from "../src/lib/grader/grade-core.ts";
import { callAnthropic, graderModel } from "../src/lib/grader/model-http.ts";

type Anchor = { id: string; min: number; max: number; answer: string };
type AnchorFile = { slug: string; anchors: Anchor[] };

const TARGET_ANCHORS = 8;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("challenge:calibrate needs ANTHROPIC_API_KEY. Nothing was graded.");
  process.exit(1);
}

const challenges: Challenge[] = [];
const dir = new URL("../content/challenges/", import.meta.url);
for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
  const rows = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as unknown[];
  for (const row of rows) {
    const parsed = challengeSchema.safeParse(row);
    if (parsed.success) challenges.push(parsed.data);
  }
}

const anchorDir = new URL("../content/anchors/", import.meta.url);
let anchorFiles: string[] = [];
try {
  anchorFiles = readdirSync(anchorDir).filter((name) => name.endsWith(".json"));
} catch {
  anchorFiles = [];
}

if (anchorFiles.length === 0) {
  console.error("No anchors found in content/anchors. Calibration has nothing to check.");
  process.exit(1);
}

let failures = 0;
const model = graderModel();

for (const file of anchorFiles) {
  const anchors = JSON.parse(readFileSync(new URL(file, anchorDir), "utf8")) as AnchorFile;
  const challenge = challenges.find((candidate) => candidate.slug === anchors.slug);

  if (!challenge) {
    console.error(`${anchors.slug}: anchors exist but the challenge does not`);
    failures += 1;
    continue;
  }

  if (!challenge.rubric) {
    console.error(`${anchors.slug}: anchors on a challenge with no rubric`);
    failures += 1;
    continue;
  }

  if (anchors.anchors.length < TARGET_ANCHORS) {
    console.warn(
      `${anchors.slug}: ${anchors.anchors.length} anchor(s), ${TARGET_ANCHORS} wanted — ranges are provisional`
    );
  }

  for (const anchor of anchors.anchors) {
    const grade = await gradeRubric({ challenge, answer: anchor.answer, model, callModel: callAnthropic });

    if ("error" in grade) {
      console.error(`${anchors.slug}/${anchor.id}: ${grade.error}`);
      failures += 1;
      continue;
    }

    const inRange = grade.score >= anchor.min && grade.score <= anchor.max;
    console.log(
      `${inRange ? "ok  " : "FAIL"} ${anchors.slug}/${anchor.id}: ${grade.score} ` +
        `(expected ${anchor.min}-${anchor.max}, ${grade.samples} samples)`
    );
    if (!inRange) failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} anchor(s) outside range. Do not publish until this is understood.`);
  process.exit(1);
}

console.log("\nCalibration passed.");
