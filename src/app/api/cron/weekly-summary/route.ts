import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { logger } from "@/lib/logger";
import { composeStreakWarning, composeWeeklySummary, summariseWeek } from "@/lib/email-content";
import { emailTransport, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Weekly record email. Call once a week (Monday morning) with
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * Consent is the gate, not an afterthought: a person is only written to when
 * their latest `product_emails` consent is granted. Everyone else is counted as
 * skipped and never sees a message — including people who withdrew consent
 * after a previous send.
 *
 * The cap exists so a bad week cannot turn into 50,000 emails before someone
 * notices; the next run picks up where this one stopped.
 */
const MAX_SENDS_PER_RUN = 50;
const LOOKBACK_DAYS = 7;

type AttemptRow = {
  user_id: string;
  score: number | null;
  practice_date: string;
  challenges: { category: string | null } | { category: string | null }[] | null;
};

function categoryOf(row: AttemptRow): string | null {
  const relation = Array.isArray(row.challenges) ? row.challenges[0] : row.challenges;
  return relation?.category ?? null;
}

/** Maps user ids to addresses in one pass; no per-recipient auth lookups. */
async function resolveEmails(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const wanted = new Set(userIds);
  const found = new Map<string, string>();

  for (let page = 1; page <= 10 && found.size < wanted.size; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;

    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email && wanted.has(user.id)) found.set(user.id, user.email);
    }
    if (users.length < 200) break;
  }

  return found;
}

export async function GET(request: Request) {
  const secret = getCronSecret();
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const transport = emailTransport();
  if (!transport) {
    return NextResponse.json(
      {
        error: "email_not_configured",
        hint: "Set KNOCK_API_KEY (orchestration) or RESEND_API_KEY + EMAIL_FROM (direct send).",
      },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data: attemptRows, error: attemptError } = await admin
    .from("challenge_attempts")
    .select("user_id, score, practice_date, challenges(category)")
    .gte("practice_date", sinceDate)
    .order("practice_date", { ascending: false })
    .limit(5000);

  if (attemptError) {
    logger.error("Weekly email attempt read failed", { code: attemptError.code });
    return NextResponse.json({ error: "queue_unavailable" }, { status: 500 });
  }

  const byUser = new Map<string, AttemptRow[]>();
  for (const row of (attemptRows ?? []) as unknown as AttemptRow[]) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  }

  const candidates = [...byUser.keys()].slice(0, MAX_SENDS_PER_RUN);
  if (candidates.length === 0) {
    return NextResponse.json(
      { candidates: 0, sent: 0, skipped: 0, failed: 0, transport, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Latest consent row per person decides; an older grant cannot override a withdrawal.
  const { data: consents } = await admin
    .from("user_consents")
    .select("user_id, granted, created_at")
    .in("user_id", candidates)
    .eq("purpose", "product_emails")
    .order("created_at", { ascending: false });

  const granted = new Map<string, boolean>();
  for (const row of (consents ?? []) as { user_id: string; granted: boolean }[]) {
    if (!granted.has(row.user_id)) granted.set(row.user_id, row.granted);
  }

  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", candidates);

  const names = new Map<string, string | null>(
    ((profileRows ?? []) as { id: string; display_name: string | null }[]).map((row) => [
      row.id,
      row.display_name,
    ])
  );

  const { data: streakRows } = await admin
    .from("streaks")
    .select("user_id, current_streak")
    .in("user_id", candidates);

  const streaks = new Map<string, number>(
    ((streakRows ?? []) as { user_id: string; current_streak: number }[]).map((row) => [
      row.user_id,
      row.current_streak,
    ])
  );

  const emails = transport === "resend" ? await resolveEmails(admin, candidates) : new Map<string, string>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://forge.app";
  const unsubscribeUrl = `${appUrl}/settings#emails`;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of candidates) {
    if (granted.get(userId) !== true) {
      skipped += 1;
      continue;
    }

    const rows = byUser.get(userId) ?? [];
    const week = summariseWeek(
      rows.map((row) => ({
        score: row.score,
        practice_date: row.practice_date,
        category: categoryOf(row),
      })),
      streaks.get(userId) ?? 0
    );

    const content = composeWeeklySummary({
      displayName: names.get(userId) ?? null,
      week,
      appUrl,
      unsubscribeUrl,
    });

    if (!content) {
      skipped += 1;
      continue;
    }

    const result = await sendEmail({
      recipient: { userId, email: emails.get(userId) ?? null },
      workflow: "weekly-summary",
      data: { week, streak: week.streak },
      content,
    });

    if (result.sent) sent += 1;
    else if (result.reason === "not_configured" || result.reason === "invalid_recipient") skipped += 1;
    else failed += 1;
  }

  logger.info("Weekly email run complete", { candidates: candidates.length, sent, skipped, failed, transport });

  return NextResponse.json(
    { candidates: candidates.length, sent, skipped, failed, transport, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Streak warnings are a separate trigger because they are time-boxed: they only
 * make sense late in the day, and only for people who have not already
 * practised. Kept as a POST so a scheduler cannot fire it by accident on a
 * plain link check.
 */
export async function POST(request: Request) {
  const secret = getCronSecret();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const transport = emailTransport();
  const admin = createAdminClient();
  if (!transport || !admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Streaks that were alive yesterday and are still open today.
  const { data: streakRows } = await admin
    .from("streaks")
    .select("user_id, current_streak, last_practice_date")
    .eq("last_practice_date", yesterday)
    .gte("current_streak", 1)
    .limit(MAX_SENDS_PER_RUN);

  const rows = (streakRows ?? []) as {
    user_id: string;
    current_streak: number;
    last_practice_date: string;
  }[];

  if (rows.length === 0) {
    return NextResponse.json({ candidates: 0, sent: 0, skipped: 0, failed: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const ids = rows.map((row) => row.user_id);

  const { data: consents } = await admin
    .from("user_consents")
    .select("user_id, granted, created_at")
    .in("user_id", ids)
    .eq("purpose", "product_emails")
    .order("created_at", { ascending: false });

  const granted = new Map<string, boolean>();
  for (const row of (consents ?? []) as { user_id: string; granted: boolean }[]) {
    if (!granted.has(row.user_id)) granted.set(row.user_id, row.granted);
  }

  const { data: profileRows } = await admin.from("profiles").select("id, display_name").in("id", ids);
  const names = new Map<string, string | null>(
    ((profileRows ?? []) as { id: string; display_name: string | null }[]).map((row) => [row.id, row.display_name])
  );

  const emails = transport === "resend" ? await resolveEmails(admin, ids) : new Map<string, string>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://forge.app";
  const unsubscribeUrl = `${appUrl}/settings#emails`;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (granted.get(row.user_id) !== true) {
      skipped += 1;
      continue;
    }

    // Already practised today: the warning would be wrong.
    const { count } = await admin
      .from("challenge_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", row.user_id)
      .eq("practice_date", today);

    if ((count ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const content = composeStreakWarning({
      displayName: names.get(row.user_id) ?? null,
      streak: row.current_streak,
      appUrl,
      unsubscribeUrl,
    });

    const result = await sendEmail({
      recipient: { userId: row.user_id, email: emails.get(row.user_id) ?? null },
      workflow: "streak-warning",
      data: { streak: row.current_streak },
      content,
    });

    if (result.sent) sent += 1;
    else if (result.reason === "not_configured" || result.reason === "invalid_recipient") skipped += 1;
    else failed += 1;
  }

  logger.info("Streak warning run complete", { candidates: rows.length, sent, skipped, failed, transport });

  return NextResponse.json(
    { candidates: rows.length, sent, skipped, failed, transport, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
