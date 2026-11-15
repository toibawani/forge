import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it must only ever be used for actions
 * the user has explicitly requested and the server has authorised:
 * erasing an account, writing breach records, processing the deletion queue.
 *
 * Returns null when the key is not configured so callers can fail closed with
 * a clear 503 instead of silently doing nothing.
 */
export function createAdminClient(): SupabaseClient | null {
  const serviceRoleKey = getServiceRoleKey();
  const { supabaseUrl } = getPublicEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": "forge-server-admin" },
    },
  });
}
