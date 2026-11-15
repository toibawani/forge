import { apiRoute, fail, ok, readJson } from "@/lib/api";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { newPasswordSchema } from "@/lib/validations";

/**
 * Sets a new password for the recovery session created by the email link.
 *
 * Authentication is required, and it is the whole security model here: the only
 * way to reach this handler is to hold a session that `/auth/callback` created
 * by exchanging a real one-time code. No reset token is accepted from the body,
 * so a leaked or guessed token cannot change a password.
 */
export const POST = apiRoute(async ({ request, requestId, supabase, user }) => {
  const rate = await rateLimit(`password-set:${user.id}`, 5, 10 * 60 * 1000);
  if (!rate.success) {
    return fail(429, "rate_limited", "Too many attempts. Wait ten minutes and try again.");
  }

  const input = await readJson(request, newPasswordSchema);

  const { error } = await supabase.auth.updateUser({ password: input.password });

  if (error) {
    logger.warn("Password update rejected", { code: error.code, status: error.status }, user.id, requestId);

    if (error.code === "weak_password" || error.status === 422) {
      return fail(400, "weak_password", "That password is too weak. Use a longer one.");
    }

    if (error.status === 401) {
      return fail(
        401,
        "recovery_expired",
        "That reset link has expired. Request a new one and try again."
      );
    }

    return fail(400, "reset_failed", "We could not update that password. Request a new link.");
  }

  logger.info("Password updated from recovery session", undefined, user.id, requestId);

  return ok({ status: "updated", next: "/dashboard" });
});
