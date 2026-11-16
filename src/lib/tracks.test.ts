import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findTrack, subSkillsOf, tracksSchema, validateTracks, type Track } from "./tracks.ts";

const raw = JSON.parse(readFileSync(new URL("../../content/tracks.json", import.meta.url), "utf8"));

test("the shipped track file validates", () => {
  const parsed = tracksSchema.safeParse(raw);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  assert.deepEqual(validateTracks(parsed.data as Track[]), []);
});

test("launch tracks are exactly the three we promised", () => {
  const parsed = tracksSchema.parse(raw) as Track[];
  assert.deepEqual(parsed.map((track) => track.id), ["coding", "sql", "writing"]);
});

test("every track has at least three sub-skills with stable ids", () => {
  const parsed = tracksSchema.parse(raw) as Track[];
  for (const track of parsed) {
    assert.ok(track.subSkills.length >= 3, `${track.id} has too few sub-skills`);
    for (const skill of track.subSkills) {
      assert.match(skill.id, /^[a-z0-9-]+$/);
    }
  }
});

test("lookups return data rather than throwing", () => {
  const parsed = tracksSchema.parse(raw) as Track[];
  assert.equal(findTrack(parsed, "sql")?.name, "SQL");
  assert.equal(findTrack(parsed, "cooking"), null);
  assert.deepEqual(subSkillsOf(parsed, "nope"), []);
});

test("a sandbox track with no language is rejected", () => {
  const problems = validateTracks([
    {
      id: "coding",
      name: "Coding",
      description: "A track with no runtime, which cannot grade anything.",
      formats: ["code"],
      languages: [],
      grading: "sandbox",
      subSkills: [{ id: "arrays", label: "Arrays" }],
    },
  ]);

  assert.ok(problems.some((problem) => problem.includes("lists no language")));
});

test("a rubric format on a sandbox track is rejected", () => {
  const problems = validateTracks([
    {
      id: "coding",
      name: "Coding",
      description: "A track that mixes grading modes.",
      formats: ["code", "rewrite"],
      languages: ["javascript"],
      grading: "sandbox",
      subSkills: [{ id: "arrays", label: "Arrays" }],
    },
  ]);

  assert.ok(problems.some((problem) => problem.includes('format "rewrite"')));
});

test("duplicate track ids are caught", () => {
  const track: Track = {
    id: "writing",
    name: "Writing",
    description: "The same track twice should be a validation failure.",
    formats: ["rewrite"],
    languages: [],
    grading: "llm",
    subSkills: [{ id: "concision", label: "Concision" }],
  };

  assert.ok(validateTracks([track, track]).some((problem) => problem.includes("defined twice")));
});
