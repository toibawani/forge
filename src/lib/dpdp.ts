import "server-only";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashUserRef } from "@/lib/request-meta";
import { logger } from "@/lib/logger";
import { DELETION_GRACE_DAYS } from "@/lib/consent";

/**
 * DPDP Act 2023 server primitives: erasure, cache purge and accountability.
 *
 * Design notes:
 *   * Consent is per purpose and versioned (see lib/consent.ts).
 *   * Erasure hard-deletes the profile and the auth user, which cascades to
 *     attempts, streaks, consents, deletion requests and recruiter notes about
 *     that candidate.
 *   * The only record that survives is a peppered hash in `deletion_audit`,
 *     which proves the request was honoured and cannot be traced back.
 */

export { POLICY_VERSION, DELETION_GRACE_DAYS, GRIEVANCE_OFFICER } from "@/lib/consent";
export {
  CONSENT_ITEMS,
  REQUIRED_CONSENT_PURPOSES,
  OPTIONAL_CONSENT_PURPOSES,
  isConsentPurpose,
} from "@/lib/consent";
export type { ConsentItem, ConsentPurpose } from "@/lib/consent";

export function deletionDateFromNow(days = DELETION_GRACE_DAYS): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export type ErasureResult = {
  ok: boolean;
  categoriesErased: string[];
  failureCode?: string;
};

/**
 * Hard-deletes every trace of a user we control. Requires the service role;
 * callers must fail closed (503) when it is not configured rather than
 * reporting a deletion that did not happen.
 */
export async function eraseUserData(userId: string): Promise<ErasureResult> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, categoriesErased: [], failureCode: "service_role_not_configured" };
  }

  const categoriesErased: string[] = [];

  // 1. Uploaded files (the avatar bucket is namespaced by user id).
  try {
    const { data: files } = await admin.storage.from("avatars").list(userId);
    if (files && files.length > 0) {
      await admin.storage.from("avatars").remove(files.map((file) => `${userId}/${file.name}`));
      categoriesErased.push("profile_photos");
    }
  } catch (error) {
    logger.warn("Storage cleanup skipped during erasure", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. Free-text and network metadata in audit rows referencing this user.
  const { error: auditError } = await admin
    .from("audit_logs")
    .update({ details: null, ip_hash: null })
    .eq("user_id", userId);
  if (!auditError) categoriesErased.push("audit_metadata");

  // 3. Profile row. Cascades to attempts, streaks, pipelines and coach notes.
  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) {
    logger.error("Profile erasure failed", { code: profileError.code });
    return { ok: false, categoriesErased, failureCode: "profile_delete_failed" };
  }
  categoriesErased.push("practice_record", "profile", "recruiter_pipelines");

  // 4. Auth user. Cascades consents, data requests and deletion rows.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    logger.error("Auth user erasure failed", { code: authError.code });
    return { ok: false, categoriesErased, failureCode: "auth_delete_failed" };
  }
  categoriesErased.push("account", "consent_register");

  await purgeUserCaches(userId);

  return { ok: true, categoriesErased };
}

/**
 * Removes personal data from every cache layer we control.
 *
 * Forge does not cache personalized API responses in a shared cache (all
 * account routes send Cache-Control: no-store), but rendered pages can still be
 * cached by the framework, and a deployment may put a CDN in front.
 */
export async function purgeUserCaches(userId: string): Promise<string[]> {
  const purged: string[] = [];

  for (const path of ["/dashboard", "/profile", "/settings"]) {
    try {
      revalidatePath(path);
      purged.push(`route:${path}`);
    } catch {
      // Outside a request scope (e.g. the cron job): skip.
    }
  }

  const purgeUrl = process.env.CACHE_PURGE_URL;
  const purgeToken = process.env.CACHE_PURGE_TOKEN;
  if (purgeUrl && purgeToken) {
    try {
      await fetch(purgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${purgeToken}`,
        },
        body: JSON.stringify({ tags: [`user:${userId}`], purgeEverything: true }),
        cache: "no-store",
      });
      purged.push("cdn");
    } catch (error) {
      logger.warn("CDN purge failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return purged;
}

/** Writes the PII-free accountability record. Service role only. */
export async function recordDeletionAudit(input: {
  userId: string;
  mode: "immediate" | "grace_period";
  status: "completed" | "failed";
  requestedAt: string;
  categoriesErased: string[];
  failureCode?: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin.from("deletion_audit").insert({
    user_ref: hashUserRef(input.userId),
    mode: input.mode,
    status: input.status,
    requested_at: input.requestedAt,
    completed_at: input.status === "completed" ? new Date().toISOString() : null,
    categories_erased: input.categoriesErased,
    failure_code: input.failureCode ?? null,
  });

  if (error) {
    logger.error("Deletion audit write failed", { code: error.code });
  }
}
