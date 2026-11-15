import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { eraseUserData, recordDeletionAudit } from "@/lib/dpdp";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Scheduled erasure worker. Call hourly from Vercel Cron (or any scheduler) with
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * Processes deletion requests whose 30-day grace period has elapsed, then runs
 * the retention cleanup function. Failing a single account never blocks the
 * rest of the queue.
 */
export async function GET(request: Request) {
  const secret = getCronSecret();
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data: due, error } = await admin
    .from("account_deletions")
    .select("id, user_id, mode, requested_at, scheduled_for")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .limit(25);

  if (error) {
    logger.error("Erasure queue read failed", { code: error.code });
    return NextResponse.json({ error: "queue_unavailable" }, { status: 500 });
  }

  let erased = 0;
  let failed = 0;

  for (const row of due ?? []) {
    await admin.from("account_deletions").update({ status: "processing" }).eq("id", row.id);

    const result = await eraseUserData(row.user_id);

    await recordDeletionAudit({
      userId: row.user_id,
      mode: row.mode === "immediate" ? "immediate" : "grace_period",
      status: result.ok ? "completed" : "failed",
      requestedAt: row.requested_at,
      categoriesErased: result.categoriesErased,
      failureCode: result.failureCode,
    });

    if (result.ok) {
      erased += 1;
    } else {
      failed += 1;
      // Keep the row visible for retry, with the failure reason for operators.
      await admin
        .from("account_deletions")
        .update({ status: "failed", failure_code: result.failureCode ?? "unknown" })
        .eq("id", row.id);
      logger.error("Erasure failed for queued account", {
        failureCode: result.failureCode,
        requestId: row.id,
      });
    }
  }

  const { data: retention } = await admin.rpc("purge_expired_data");

  return NextResponse.json(
    {
      processed: due?.length ?? 0,
      erased,
      failed,
      retention: retention ?? null,
      at: now,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
