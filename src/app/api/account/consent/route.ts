import { HttpError, apiRoute, ok, readJson } from "@/lib/api";
import { CONSENT_ITEMS, POLICY_VERSION } from "@/lib/dpdp";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";
import { consentUpdateSchema } from "@/lib/validations";

/** Reads the consent register for the signed-in user. */
export const GET = apiRoute(async ({ supabase, user }) => {
  const { data } = await supabase
    .from("user_consents")
    .select("purpose, granted, policy_version, granted_at, withdrawn_at")
    .eq("user_id", user.id)
    .order("purpose");

  return ok({
    policyVersion: POLICY_VERSION,
    purposes: CONSENT_ITEMS,
    consents: data ?? [],
  });
});

/**
 * Grants or withdraws an optional consent purpose.
 *
 * Required purposes cannot be withdrawn here (the database enforces it) —
 * deleting the account is the only way to stop core processing, which is the
 * honest answer under DPDP rather than a half-working toggle.
 */
export const POST = apiRoute(
  async ({ request, supabase, user, requestId, profile }) => {
    const input = await readJson(request, consentUpdateSchema);

    const { error } = await supabase.from("user_consents").upsert(
      {
        user_id: user.id,
        purpose: input.purpose,
        policy_version: POLICY_VERSION,
        granted: input.granted,
      },
      { onConflict: "user_id,purpose,policy_version" }
    );

    if (error) {
      throw new HttpError(
        400,
        "consent_update_failed",
        "We could not save that choice. Reload and try again."
      );
    }

    // Turning off recruiter discovery also closes direct contact: the data
    // principal said no, so both channels close together.
    if (input.purpose === "recruiter_discovery" && !input.granted) {
      await supabase.from("profiles").update({ allow_recruiter_contact: false }).eq("id", user.id);
    }

    await logAuditEvent(supabase, user.id, {
      action: input.granted ? "consent_granted" : "consent_withdrawn",
      resourceType: "user_consents",
      resourceId: input.purpose,
      details: { policyVersion: POLICY_VERSION },
      ipHash: hashIp(requestIp(request.headers)),
      actorRole: profile.role,
    });

    return ok({ purpose: input.purpose, granted: input.granted, requestId });
  },
  { mutation: true }
);
