import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { challengeSchema, publicChallenge, validateAgainstTrack, type Challenge } from "./challenge-model.ts";
import { tracksSchema, type Track } from "./tracks.ts";

const tracks = tracksSchema.parse(
  JSON.parse(readFileSync(new URL("../../content/tracks.json", import.meta.url), "utf8"))
) as Track[];

const coding = JSON.parse(
  readFileSync(new URL("../../content/challenges/coding.json", import.meta.url), "utf8")
) as Challenge[];

const writing = JSON.parse(
  readFileSync(new URL("../../content/challenges/writing.json", import.meta.url), "utf8")
) as Challenge[];

test("every shipped challenge validates against the model", () => {
  for (const challenge of [...coding, ...writing]) {
    const parsed = challengeSchema.safeParse(challenge);
    assert.equal(
      parsed.success,
      true,
      `${challenge.slug}: ${parsed.success ? "" : parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ")}`
    );
  }
});

test("every shipped challenge belongs to its track", () => {
  for (const challenge of [...coding, ...writing]) {
    assert.deepEqual(validateAgainstTrack(challenge, tracks), [], challenge.slug);
  }
});

test("shipped slugs are unique", () => {
  const slugs = [...coding, ...writing].map((challenge) => challenge.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("everything shipped starts as a draft", () => {
  for (const challenge of [...coding, ...writing]) {
    assert.equal(challenge.status, "draft", `${challenge.slug} must not ship published`);
  }
});

test("challenge files on disk are covered by the test above", () => {
  const files = readdirSync(new URL("../../content/challenges", import.meta.url)).filter((name) =>
    name.endsWith(".json")
  );
  assert.deepEqual(files.sort(), ["coding.json", "writing.json"]);
});

test("a rubric format without a rubric is rejected", () => {
  const [challenge] = writing;
  const broken = { ...challenge, rubric: undefined };

  const parsed = challengeSchema.safeParse(broken);
  assert.equal(parsed.success, false);
  assert.ok(parsed.error?.issues.some((issue) => issue.path.includes("rubric")));
});

test("a sandbox format with no hidden test is rejected", () => {
  const [challenge] = coding;
  const broken = {
    ...challenge,
    tests: challenge.tests.map((test) => ({ ...test, hidden: false })),
  };

  const parsed = challengeSchema.safeParse(broken);
  assert.equal(parsed.success, false);
  assert.ok(parsed.error?.issues.some((issue) => issue.message.includes("hidden")));
});

test("a rubric answer with executable tests is rejected", () => {
  const [challenge] = writing;
  const broken = {
    ...challenge,
    tests: coding[0].tests,
  };

  const parsed = challengeSchema.safeParse(broken);
  assert.equal(parsed.success, false);
  assert.ok(parsed.error?.issues.some((issue) => issue.path.includes("tests")));
});

test("the public projection removes tests and the reference solution", () => {
  const projection = publicChallenge(coding[0]) as Record<string, unknown>;

  assert.equal("tests" in projection, false);
  assert.equal("reference" in projection, false);
  assert.deepEqual(projection.testCategories, ["example", "empty input", "boundary", "large input"]);
  assert.ok(Array.isArray(projection.constraints));
});

test("an unknown sub-skill is caught before publication", () => {
  const [challenge] = coding;
  const problems = validateAgainstTrack({ ...challenge, subSkills: ["quantum"] }, tracks);

  assert.equal(problems.length, 1);
  assert.match(problems[0].problem, /unknown sub-skill/);
});

test("an unknown track is caught with the slug named", () => {
  const [challenge] = coding;
  const problems = validateAgainstTrack({ ...challenge, track: "cooking" }, tracks);

  assert.equal(problems[0].slug, challenge.slug);
  assert.match(problems[0].problem, /unknown track/);
});
