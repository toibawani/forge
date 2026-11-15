import { apiRoute, fail, ok, readJson } from "@/lib/api";
import {
  DELETION_GRACE_DAYS,
  deletionDateFromNow,
  eraseUserData,
  recordDeletionAudit,
} from "@/lib/dpdp";
import { isAdminConfigured } from "@/lib/env";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";
import { deleteAccountSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * DPDP right to erasure.
 *
 * Two modes:
 *   * grace_period (default) — the account is frozen immediately and erased by
 *     the scheduled job after 30 days. The user can cancel until then.
 *   * immediate — erased synchronously. Requires the service role because
 *     deleting the auth user is an admin operation.
 *
 * Either way the accountability record stores a peppered hash, never an id,
 * email or any other personal data.
 */
export const POST = apiRoute(
  async ({ request, supabase, user, requestId }) => {
    const input = await readJson(request, deleteAccountSchema);

    if (input.mode === "immediate" && !isAdminConfigured()) {
      return fail(
        503,
        "erasure_unavailable",
        "Immediate deletion is temporarily unavailable. Choose the 30-day option, or contact the grievance officer."
      );
    }

    const requestedAt = new Date().toISOString();

    const { data, error } = await supabase.rpc("request_account_deletion", {
      p_mode: input.mode,
      p_reason: input.reason ?? null,
    });

    if (error) {
      logger.error("Deletion request failed", { code: error.code }, user.id, requestId);
      return fail(500, "deletion_request_failed", "We could not record the deletion request.");
    }

    const row = Array.isArray(data) ? data[0] : data;

    await logAuditEvent(supabase, user.id, {
      action: input.mode === "immediate" ? "account_deletion_immediate" : "account_deletion_scheduled",
      resourceType: "account_deletions",
      details: { mode: input.mode, graceDays: input.mode === "grace_period" ? DELETION_GRACE_DAYS : 0 },
      ipHash: hashIp(requestIp(request.headers)),
    });

    if (input.mode === "grace_period") {
      return ok({
        status: "scheduled",
        scheduledFor: row?.scheduled_for ?? deletionDateFromNow(DELETION_GRACE_DAYS).toISOString(),
        graceDays: DELETION_GRACE_DAYS,
      });
    }

    // Immediate: freeze the session first, then erase.
    try {
      await supabase.auth.signOut();
    } catch {
      // Session may already be invalid; erasure still proceeds.
    }

    const result = await eraseUserData(user.id);

    await recordDeletionAudit({
      userId: user.id,
      mode: "immediate",
      status: result.ok ? "completed" : "failed",
      requestedAt,
      categoriesErased: result.categoriesErased,
      failureCode: result.failureCode,
    });

    if (!result.ok) {
      logger.error("Immediate erasure failed", { failureCode: result.failureCode }, undefined, requestId);
      return fail(
        500,
        "erasure_incomplete",
        "Part of your data could not be erased. Contact the grievance officer and quote this request id.",
        { requestId }
      );
    }

    logger.info("Account erased", { categories: result.categoriesErased.length }, undefined, requestId);

    return ok({ status: "deleted", erased: result.categoriesErased });
  },
  { mutation: true, allowPendingDeletion: true }
);

/** Current deletion state, so settings can show the countdown and a cancel action. */
export const GET = apiRoute(
  async ({ supabase, user }) => {
    const { data } = await supabase
      .from("account_deletions")
      .select("id, mode, status, requested_at, scheduled_for, reason_code")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return ok({ deletion: data ?? null, graceDays: DELETION_GRACE_DAYS });
  },
  { allowPendingDeletion: true }
);
