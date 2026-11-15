import { HttpError, apiRoute, created, ok, readJson } from "@/lib/api";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";
import { dataRequestSchema } from "@/lib/validations";

/**
 * DPDP data principal requests: access, correction, erasure, grievance and
 * nomination. These create a tracked ticket the grievance officer works
 * through, instead of an untracked email thread.
 */
export const GET = apiRoute(async ({ supabase, user }) => {
  const { data } = await supabase
    .from("data_requests")
    .select("id, kind, details, status, created_at, resolved_at, resolution_note")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return ok({ requests: data ?? [] });
});

export const POST = apiRoute(
  async ({ request, supabase, user, requestId, profile }) => {
    const input = await readJson(request, dataRequestSchema);

    const { data, error } = await supabase
      .from("data_requests")
      .insert({
        user_id: user.id,
        kind: input.kind,
        details: input.details,
      })
      .select("id, kind, status, created_at")
      .single();

    if (error) {
      throw new HttpError(500, "request_failed", "We could not record that request. Try again.");
    }

    await logAuditEvent(supabase, user.id, {
      action: "data_request_created",
      resourceType: "data_requests",
      resourceId: data.id,
      details: { kind: input.kind },
      ipHash: hashIp(requestIp(request.headers)),
      actorRole: profile.role,
    });

    return created({ request: data, requestId });
  },
  { mutation: true }
);
