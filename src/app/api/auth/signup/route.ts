import { apiRoute, created, fail, readJson } from "@/lib/api";
import { POLICY_VERSION } from "@/lib/dpdp";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp, requestIp } from "@/lib/request-meta";
import { getPublicEnv } from "@/lib/env";
import { signUpSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * Creates an account and records consent.
 *
 * Consent proof travels in the auth user's metadata, which is written by this
 * server handler only (presence of a policy version is what the signup
 * trigger turns into consent rows). A signup made outside this endpoint has no
 * consent recorded, which the app surfaces in settings rather than assuming.
 */
export const POST = apiRoute(
  async ({ request, requestId, supabase }) => {
    const ipHash = hashIp(requestIp(request.headers));

    const rate = rateLimit(`signup:${ipHash ?? "anonymous"}`, 5, 60 * 60 * 1000);
    if (!rate.success) {
      return fail(429, "rate_limited", "Too many sign-up attempts. Try again later.");
    }

    const input = await readJson(request, signUpSchema);

    if (input.policyVersion !== POLICY_VERSION) {
      return fail(
        409,
        "policy_changed",
        "Our policies were updated. Reload the page and review them again."
      );
    }

    const { appUrl } = getPublicEnv();

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
        data: {
          role: input.role,
          display_name: input.displayName ?? null,
          policy_version: POLICY_VERSION,
          consent_at: new Date().toISOString(),
          consent_recruiter_discovery: input.recruiterDiscovery,
          consent_product_emails: input.productEmails,
          signup_ip_hash: ipHash,
        },
      },
    });

    if (error) {
      logger.warn("Signup rejected", { code: error.code, status: error.status }, undefined, requestId);

      if (error.status === 429) {
        return fail(429, "rate_limited", "Too many attempts. Try again in a few minutes.");
      }

      if (error.code === "weak_password" || error.code === "signup_disabled") {
        return fail(400, "signup_rejected", "That password does not meet our requirements.");
      }

      // Generic: avoids leaking whether an address is already registered.
      return fail(
        400,
        "signup_rejected",
        "We could not create that account. Check your details and try again."
      );
    }

    logger.info("Signup accepted", { hasSession: Boolean(data.session) }, data.user?.id, requestId);

    return created({
      status: data.session ? "signed_in" : "verify_email",
      next: data.session ? "/dashboard" : "/login?checkEmail=1",
    });
  },
  { auth: "public", mutation: true }
);
