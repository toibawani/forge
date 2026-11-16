import test from "node:test";
import assert from "node:assert/strict";

import { buildPaletteResults, type PaletteChallenge, type PaletteItem } from "./palette.ts";

const ITEMS: PaletteItem[] = [
  { href: "/dashboard", label: "Dashboard", hint: "streak, trends, today's session" },
  { href: "/practice", label: "Practice", hint: "pick today's challenge" },
  { href: "/settings", label: "Settings", hint: "profile, consent, export" },
];

const CHALLENGES: PaletteChallenge[] = [
  { slug: "slow-endpoint", title: "The endpoint that takes nine seconds", category: "engineering", difficulty: "intermediate" },
  { slug: "pricing-page-critique", title: "Critique a pricing page", category: "design", difficulty: "beginner" },
  { slug: "objection-handling", title: "Handle a price objection", category: "sales", difficulty: "advanced" },
];

test("an empty query shows navigation only", () => {
  const results = buildPaletteResults(ITEMS, CHALLENGES, "");
  assert.deepEqual(results.map((item) => item.href), ITEMS.map((item) => item.href));
});

test("whitespace is treated as an empty query", () => {
  assert.equal(buildPaletteResults(ITEMS, CHALLENGES, "   ").length, ITEMS.length);
});

test("navigation matches on its hint, not only its label", () => {
  const results = buildPaletteResults(ITEMS, CHALLENGES, "consent");
  assert.deepEqual(results.map((item) => item.href), ["/settings"]);
});

test("challenges are searched by title, category, slug and difficulty", () => {
  assert.equal(buildPaletteResults(ITEMS, CHALLENGES, "pricing")[0].href, "/practice/pricing-page-critique");
  assert.equal(buildPaletteResults(ITEMS, CHALLENGES, "sales")[0].href, "/practice/objection-handling");
  assert.equal(buildPaletteResults(ITEMS, CHALLENGES, "slow-endpoint")[0].href, "/practice/slow-endpoint");
  assert.equal(buildPaletteResults(ITEMS, CHALLENGES, "advanced")[0].href, "/practice/objection-handling");
});

test("matching is case-insensitive", () => {
  const results = buildPaletteResults(ITEMS, CHALLENGES, "DASH");
  assert.deepEqual(results.map((item) => item.href), ["/dashboard"]);
});

test("challenges are capped so the list stays navigable", () => {
  const many = Array.from({ length: 20 }, (_, index) => ({
    slug: `challenge-${index}`,
    title: `Challenge ${index}`,
    category: "engineering",
    difficulty: "beginner",
  }));

  assert.equal(buildPaletteResults([], many, "challenge").length, 6);
});

test("nothing matches returns an empty list rather than everything", () => {
  assert.deepEqual(buildPaletteResults(ITEMS, CHALLENGES, "zzzz"), []);
});

test("a duplicated destination appears once", () => {
  const duplicated: PaletteItem[] = [
    ...ITEMS,
    { href: "/practice/slow-endpoint", label: "Slow endpoint", hint: "engineering" },
  ];
  const results = buildPaletteResults(duplicated, CHALLENGES, "slow");
  assert.equal(results.filter((item) => item.href === "/practice/slow-endpoint").length, 1);
});
