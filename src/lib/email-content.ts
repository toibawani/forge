/**
 * Email content.
 *
 * Pure functions, so what we send can be asserted without a mail provider. Two
 * rules govern the copy:
 *
 *   * Only measured facts. No "you're on fire", no invented percentiles.
 *   * Nothing is sent when there is nothing to report. A weekly email that says
 *     "you did nothing" is a churn email wearing a summary's clothes.
 */

export type WeekAggregate = {
  attempts: number;
  daysPractised: number;
  averageScore: number | null;
  bestScore: number | null;
  strongestCategory: string | null;
  streak: number;
};

export type WeekAttempt = {
  score: number | null;
  practice_date: string;
  category: string | null;
};

/** Aggregates one person's week from rows the caller already fetched. */
export function summariseWeek(attempts: WeekAttempt[], streak: number): WeekAggregate {
  const scored = attempts.filter((attempt) => typeof attempt.score === "number");
  const byCategory = new Map<string, number[]>();

  for (const attempt of scored) {
    if (!attempt.category) continue;
    byCategory.set(attempt.category, [
      ...(byCategory.get(attempt.category) ?? []),
      attempt.score as number,
    ]);
  }

  let strongestCategory: string | null = null;
  let strongest = -1;
  for (const [category, scores] of byCategory) {
    const average = scores.reduce((total, score) => total + score, 0) / scores.length;
    if (average > strongest) {
      strongest = average;
      strongestCategory = category;
    }
  }

  return {
    attempts: attempts.length,
    daysPractised: new Set(attempts.map((attempt) => attempt.practice_date)).size,
    averageScore:
      scored.length === 0
        ? null
        : Math.round(scored.reduce((total, attempt) => total + (attempt.score ?? 0), 0) / scored.length),
    bestScore: scored.length === 0 ? null : Math.max(...scored.map((attempt) => attempt.score as number)),
    strongestCategory,
    streak,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

function skillName(category: string | null): string {
  if (!category) return "your practice";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Weekly summary. Returns null when the week is empty — the caller must skip
 * the send rather than mail someone a zero.
 */
export function composeWeeklySummary(input: {
  displayName: string | null;
  week: WeekAggregate;
  appUrl: string;
  unsubscribeUrl: string;
}): EmailContent | null {
  const { week } = input;
  if (week.attempts === 0) return null;

  const name = input.displayName?.trim() || "there";
  const scoreLine =
    week.averageScore === null
      ? "No scored attempts this week."
      : `Average score ${week.averageScore}, best ${week.bestScore}.`;

  const subject = `${week.daysPractised} day${week.daysPractised === 1 ? "" : "s"} practised this week`;

  const text = [
    `Hello ${name},`,
    "",
    `You practised on ${week.daysPractised} day${week.daysPractised === 1 ? "" : "s"} this week across ${week.attempts} attempt${week.attempts === 1 ? "" : "s"}.`,
    scoreLine,
    week.strongestCategory ? `Strongest area: ${skillName(week.strongestCategory)}.` : "",
    `Current streak: ${week.streak} day${week.streak === 1 ? "" : "s"}.`,
    "",
    `Your record: ${input.appUrl}/profile`,
    "",
    `These emails are optional. Turn them off any time: ${input.unsubscribeUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f7f6f3;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e3de;border-radius:6px;padding:24px;">
    <p style="margin:0;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b6b6b;">Forge · weekly record</p>
    <h1 style="margin:12px 0 0;font-size:20px;letter-spacing:-0.01em;">${escapeHtml(subject)}</h1>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#4a4a4a;">Hello ${escapeHtml(name)}, you logged ${week.attempts} attempt${week.attempts === 1 ? "" : "s"} on ${week.daysPractised} day${week.daysPractised === 1 ? "" : "s"}. ${escapeHtml(scoreLine)}</p>
    ${
      week.strongestCategory
        ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4a4a4a;">Strongest area: ${escapeHtml(skillName(week.strongestCategory))}.</p>`
        : ""
    }
    <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4a4a4a;">Current streak: ${week.streak} day${week.streak === 1 ? "" : "s"}.</p>
    <p style="margin:20px 0 0;"><a href="${escapeHtml(input.appUrl)}/profile" style="display:inline-block;background:#1c3d5a;color:#f7f6f3;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;">Open your record</a></p>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6b6b6b;">These emails are optional. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#4a4a4a;">Turn them off</a> and Forge will still keep your record.</p>
  </div>
</body></html>`;

  return { subject, html, text };
}

/**
 * Streak warning, sent only when a streak exists and today is still open. It
 * names the number at stake and nothing else — no guilt copy.
 */
export function composeStreakWarning(input: {
  displayName: string | null;
  streak: number;
  appUrl: string;
  unsubscribeUrl: string;
}): EmailContent {
  const name = input.displayName?.trim() || "there";
  const days = input.streak === 1 ? "1-day streak" : `${input.streak}-day streak`;

  const subject = `Your ${days} is still open today`;
  const text = [
    `Hello ${name},`,
    "",
    `You have a ${days} on Forge and nothing logged today. A short session keeps it.`,
    "",
    `${input.appUrl}/practice`,
    "",
    `These emails are optional. Turn them off: ${input.unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f7f6f3;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e3de;border-radius:6px;padding:24px;">
    <p style="margin:0;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b6b6b;">Forge · streak</p>
    <h1 style="margin:12px 0 0;font-size:20px;letter-spacing:-0.01em;">${escapeHtml(subject)}</h1>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#4a4a4a;">Hello ${escapeHtml(name)}, you have a ${escapeHtml(days)} and nothing logged today. A short session keeps it.</p>
    <p style="margin:20px 0 0;"><a href="${escapeHtml(input.appUrl)}/practice" style="display:inline-block;background:#1c3d5a;color:#f7f6f3;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;">Practise today</a></p>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6b6b6b;">These emails are optional. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#4a4a4a;">Turn them off</a>.</p>
  </div>
</body></html>`;

  return { subject, html, text };
}
