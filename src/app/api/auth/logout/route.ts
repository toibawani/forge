import { apiRoute, ok } from "@/lib/api";
import { logger } from "@/lib/logger";

export const POST = apiRoute(
  async ({ supabase, requestId, user }) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.warn("Logout error", { code: error.code }, user.id, requestId);
      // The cookies are cleared either way; report success so the client can
      // always leave the authenticated area.
    }

    return ok({ status: "signed_out" });
  },
  { auth: "optional", mutation: true }
);
