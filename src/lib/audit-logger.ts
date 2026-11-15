import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEvent = {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipHash?: string | null;
  actorRole?: string;
};

/**
 * Records an accountability event in the *user's* session. RLS only permits
 * rows where user_id = auth.uid(), so this cannot be used to write into
 * another user's trail. Never pass emails, tokens or free-text personal data
 * in `details`.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  userId: string | null,
  event: AuditEvent
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: userId,
    actor_role: event.actorRole ?? null,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId ?? null,
    details: event.details ?? null,
    ip_hash: event.ipHash ?? null,
  });

  if (error) {
    // Audit failures must never break the user's request, but they must be
    // visible to operators.
    console.error("[audit] failed to record event", {
      action: event.action,
      code: error.code,
    });
  }
}
