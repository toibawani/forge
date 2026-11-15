import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

/**
 * Cookie-bound Supabase client for server components and route handlers.
 *
 * This is the only client that should be used to authenticate a request: it
 * reads the httpOnly session cookies written by @supabase/ssr. Using the
 * browser client on the server returns no session and makes every endpoint
 * look unauthenticated.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });
          });
        } catch {
          // Called from a Server Component render: middleware refreshes the
          // session instead, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerSession = {
  supabase: SupabaseClient;
  user: User;
};

/** Returns the verified user for this request, or null. Never trusts a JWT payload alone. */
export async function getServerUser(): Promise<ServerSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return { supabase, user };
}
