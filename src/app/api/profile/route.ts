import { apiRoute, fail, ok, readJson } from "@/lib/api";
import { updateProfileSchema } from "@/lib/validations";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";
import { purgeUserCaches } from "@/lib/dpdp";

/** The signed-in user's own profile. Always private, always uncached. */
export const GET = apiRoute(async ({ supabase, user }) => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, headline, bio, avatar_url, skills, role, company_name, visibility, allow_recruiter_contact, profile_views_count, consent_at, consent_policy_version, created_at, updated_at"
    )
    .eq("id", user.id)
    .single();

  if (error) {
    return fail(500, "profile_unavailable", "We could not load your profile.");
  }

  return ok({ profile });
});

export const PATCH = apiRoute(async ({ request, supabase, user, requestId, profile }) => {
  const input = await readJson(request, updateProfileSchema);

  // camelCase -> snake_case, explicit allow-list. Role, counters and erasure
  // state are not writable here, and the database rejects them anyway.
  const patch: Record<string, unknown> = {};
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.headline !== undefined) patch.headline = input.headline;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.skills !== undefined) patch.skills = input.skills;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.allowRecruiterContact !== undefined) {
    patch.allow_recruiter_contact = input.allowRecruiterContact;
  }
  if (input.companyName !== undefined) patch.company_name = input.companyName;

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select(
      "id, display_name, headline, bio, skills, visibility, allow_recruiter_contact, company_name, updated_at"
    )
    .single();

  if (error) {
    return fail(500, "profile_update_failed", "We could not save those changes.", { requestId });
  }

  await logAuditEvent(supabase, user.id, {
    action: "profile_updated",
    resourceType: "profiles",
    resourceId: user.id,
    details: { fields: Object.keys(patch) },
    ipHash: hashIp(requestIp(request.headers)),
    actorRole: profile.role,
  });

  // Personal data changed: drop any rendered/cached copy of it.
  await purgeUserCaches(user.id);

  return ok({ profile: updated });
});
