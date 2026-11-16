import { apiRoute, fail, ok, rateLimited, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp, requestIp } from "@/lib/request-meta";
import { signInSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * Email + password sign in. The session is written as httpOnly cookies by the
 * server client; the browser never receives a token it can read.
 */
export const POST = apiRoute(
  async ({ request, requestId, supabase }) => {
    const ipHash = hashIp(requestIp(request.headers));

    const rate = await rateLimit(`login:${ipHash ?? "anonymous"}`, 10, 5 * 60 * 1000);
    if (!rate.success) {
      return rateLimited("Too many sign-in attempts. Wait a few minutes and try again.", rate.resetTime);
    }

    const input = await readJson(request, signInSchema);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user) {
      logger.warn("Login rejected", { code: error?.code }, undefined, requestId);
      // One message for every failure: no account enumeration.
      return fail(401, "invalid_credentials", "Email or password is incorrect.");
    }

    // If the address was never confirmed, Supabase returns a user without a
    // session. Tell the user what to do instead of pretending it worked.
    if (!data.session) {
      return fail(403, "email_unverified", "Confirm your email address, then sign in.");
    }

    logger.info("Login accepted", undefined, data.user.id, requestId);

    return ok({ status: "ok", next: "/dashboard" });
  },
  { auth: "public", mutation: true }
);
