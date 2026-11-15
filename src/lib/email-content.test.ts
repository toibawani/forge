import test from "node:test";
import assert from "node:assert/strict";

import {
  composeStreakWarning,
  composeWeeklySummary,
  escapeHtml,
  summariseWeek,
  type WeekAttempt,
} from "./email-content.ts";

const DAY = 24 * 60 * 60 * 1000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

function attempt(score: number | null, daysAgo: number, category: string | null = "engineering"): WeekAttempt {
  return { score, practice_date: iso(daysAgo), category };
}

test("a week with no attempts produces no email", () => {
  const content = composeWeeklySummary({
    displayName: "Asha",
    week: summariseWeek([], 4),
    appUrl: "https://forge.test",
    unsubscribeUrl: "https://forge.test/settings",
  });

  assert.equal(content, null);
});

test("the summary counts days, not attempts", () => {
  const week = summariseWeek(
    [attempt(80, 1), attempt(60, 1), attempt(70, 2)],
    5
  );

  assert.equal(week.attempts, 3);
  assert.equal(week.daysPractised, 2);
  assert.equal(week.averageScore, 70);
  assert.equal(week.bestScore, 80);
  assert.equal(week.streak, 5);
});

test("unscored attempts still count as days practised", () => {
  const week = summariseWeek([attempt(null, 1), attempt(90, 2)], 0);
  assert.equal(week.attempts, 2);
  assert.equal(week.averageScore, 90);
});

test("strongest area is chosen by average, not by volume", () => {
  const week = summariseWeek(
    [attempt(60, 1, "writing"), attempt(95, 2, "engineering"), attempt(50, 3, "writing")],
    3
  );
  assert.equal(week.strongestCategory, "engineering");
});

test("the summary email carries the measured numbers and an unsubscribe link", () => {
  const content = composeWeeklySummary({
    displayName: "Asha",
    week: summariseWeek([attempt(84, 1), attempt(76, 2)], 6),
    appUrl: "https://forge.test",
    unsubscribeUrl: "https://forge.test/settings",
  });

  assert.ok(content);
  assert.match(content.subject, /^2 days practised this week$/);
  assert.match(content.text, /Average score 80, best 84/);
  assert.match(content.text, /Current streak: 6 days/);
  assert.match(content.text, /https:\/\/forge\.test\/settings/);
  assert.match(content.html, /Turn them off/);
});

test("a single day and single attempt are not pluralised", () => {
  const content = composeWeeklySummary({
    displayName: "Asha",
    week: summariseWeek([attempt(70, 1)], 1),
    appUrl: "https://forge.test",
    unsubscribeUrl: "https://forge.test/settings",
  });

  assert.ok(content);
  assert.match(content.subject, /^1 day practised this week$/);
  assert.match(content.text, /1 attempt\b/);
  assert.match(content.text, /1 day\b/);
});

test("a missing display name falls back without inventing one", () => {
  const content = composeWeeklySummary({
    displayName: null,
    week: summariseWeek([attempt(70, 1)], 1),
    appUrl: "https://forge.test",
    unsubscribeUrl: "https://forge.test/settings",
  });

  assert.ok(content);
  assert.match(content.text, /Hello there,/);
});

test("user-provided names are escaped in html", () => {
  const content = composeWeeklySummary({
    displayName: `<script>alert("x")</script>`,
    week: summariseWeek([attempt(70, 1)], 1),
    appUrl: "https://forge.test",
    unsubscribeUrl: "https://forge.test/settings",
  });

  assert.ok(content);
  assert.ok(!content.html.includes("<script>"));
  assert.match(content.html, /&lt;script&gt;/);
});

test("escapeHtml covers the characters that break markup", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("the streak warning names the streak that is at stake", () => {
  const content = composeStreakWarning({
    displayName: "Asha",
    streak: 12,
    appUrl: "https://forge.test",
    unsubscribeUrl: "https://forge.test/settings",
  });

  assert.match(content.subject, /12-day streak/);
  assert.match(content.text, /12-day streak/);
  assert.match(content.text, /https:\/\/forge\.test\/practice/);
});

test("a one-day streak reads naturally", () => {
  const content = composeStreakWarning({
    displayName: null,
    streak: 1,
    appUrl: "https://forge.test",
    unsubscribeUrl: "https://forge.test/settings",
  });

  assert.match(content.subject, /1-day streak/);
});
