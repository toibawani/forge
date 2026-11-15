import { apiRoute, created, fail, ok, readJson } from "@/lib/api";
import { breachEventSchema } from "@/lib/validations";
import { breachReference } from "@/lib/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-logger";
import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Personal data breach register (DPDP Act 2023).
 *
 * Only admins can write here, and the service role performs the insert because
 * the table is closed to clients entirely. `summary` is validated to contain no
 * email addresses: the register is an accountability artefact, not another
 * place personal data can leak from.
 */
export const GET = apiRoute(
  async () => {
    const admin = createAdminClient();
    if (!admin) return fail(503, "not_configured", "Service role is not configured.");

    const { data, error } = await admin
      .from("breach_events")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(100);

    if (error) return fail(500, "read_failed", "Could not read the breach register.");

    return ok({ events: data ?? [] });
  },
  { roles: ["admin"] }
);

export const POST = apiRoute(
  async ({ request, supabase, user, requestId, profile }) => {
    const admin = createAdminClient();
    if (!admin) return fail(503, "not_configured", "Service role is not configured.");

    const input = await readJson(request, breachEventSchema);
    const reference = breachReference();

    const { data, error } = await admin
      .from("breach_events")
      .insert({
        reference,
        severity: input.severity,
        category: input.category,
        summary: input.summary,
        data_categories: input.dataCategories,
        affected_users_estimate: input.affectedUsersEstimate ?? null,
        occurred_at_estimate: input.occurredAtEstimate ?? null,
        containment_notes: input.containmentNotes ?? null,
        status: "open",
      })
      .select("id, reference, detected_at, severity, status")
      .single();

    if (error) {
      logger.error("Breach insert failed", { code: error.code }, user.id, requestId);
      return fail(500, "breach_write_failed", "Could not record the incident.");
    }

    await logAuditEvent(supabase, user.id, {
      action: "breach_recorded",
      resourceType: "breach_events",
      resourceId: data.reference,
      details: { severity: input.severity, category: input.category },
      actorRole: profile.role,
    });

    return created({ event: data, runbook: "docs/incident-runbook.md" });
  },
  { roles: ["admin"], mutation: true }
);

const breachUpdateSchema = z.object({
  reference: z.string().min(3).max(60),
  status: z.enum(["open", "contained", "closed"]).optional(),
  boardNotified: z.boolean().optional(),
  usersNotified: z.boolean().optional(),
  dpoNotified: z.boolean().optional(),
  containmentNotes: z.string().trim().max(4000).optional(),
});

/** Stamps notification milestones as the incident runbook is worked through. */
export const PATCH = apiRoute(
  async ({ request, supabase, user, profile }) => {
    const admin = createAdminClient();
    if (!admin) return fail(503, "not_configured", "Service role is not configured.");

    const input = await readJson(request, breachUpdateSchema);
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = {};
    if (input.status) patch.status = input.status;
    if (input.containmentNotes !== undefined) patch.containment_notes = input.containmentNotes;
    if (input.boardNotified) patch.board_notified_at = now;
    if (input.usersNotified) patch.users_notified_at = now;
    if (input.dpoNotified) patch.dpo_notified_at = now;

    if (Object.keys(patch).length === 0) {
      return fail(400, "nothing_to_update", "No fields to update.");
    }

    const { data, error } = await admin
      .from("breach_events")
      .update(patch)
      .eq("reference", input.reference)
      .select("id, reference, status, board_notified_at, users_notified_at, dpo_notified_at")
      .maybeSingle();

    if (error || !data) {
      return fail(404, "breach_not_found", "No incident with that reference.");
    }

    await logAuditEvent(supabase, user.id, {
      action: "breach_updated",
      resourceType: "breach_events",
      resourceId: input.reference,
      details: { fields: Object.keys(patch) },
      actorRole: profile.role,
    });

    return ok({ event: data });
  },
  { roles: ["admin"], mutation: true }
);
