import { apiRoute, fail, ok, readJson } from "@/lib/api";
import { getPublicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp, requestIp } from "@/lib/request-meta";
import { forgotPasswordSchema } from "@/lib/validations";

/**
 * Sends a password reset link.
 *
 * The response is identical whether or not the address has an account, because
 * a reset form is otherwise a free account-enumeration endpoint. Failures are
 * logged by code only, never with the address.
 */
export const POST = apiRoute(
  async ({ request, requestId, supabase }) => {
    const ipHash = hashIp(requestIp(request.headers));

    const rate = await rateLimit(`password-reset:${ipHash ?? "anonymous"}`, 5, 60 * 60 * 1000);
    if (!rate.success) {
      return fail(429, "rate_limited", "Too many reset requests. Try again in an hour.");
    }

    const input = await readJson(request, forgotPasswordSchema);
    const { appUrl } = getPublicEnv();

    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });

    if (error) {
      logger.warn("Password reset not sent", { code: error.code, status: error.status }, undefined, requestId);

      // Provider-side throttling is worth surfacing; anything else stays opaque.
      if (error.status === 429) {
        return fail(429, "rate_limited", "Too many reset requests. Try again in an hour.");
      }
    }

    return ok({ status: "sent" });
  },
  { auth: "public", mutation: true }
);
