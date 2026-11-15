import { apiRoute, fail, ok } from "@/lib/api";

/** Cancels a scheduled erasure while the account is frozen. */
export const POST = apiRoute(
  async ({ supabase, requestId }) => {
    const { data, error } = await supabase.rpc("cancel_account_deletion");

    if (error) {
      return fail(500, "cancel_failed", "We could not cancel the deletion request.", { requestId });
    }

    if (!data) {
      return fail(409, "nothing_to_cancel", "There is no pending deletion request.");
    }

    return ok({ status: "cancelled" });
  },
  { mutation: true, allowPendingDeletion: true }
);
