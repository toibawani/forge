/**
 * Environment access with explicit public / server-only separation.
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle by Next.js, so
 * nothing secret may ever live under that prefix. Everything else is read
 * lazily on the server and never imported by client components.
 */

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
};

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  };
}

/** True when auth + database are reachable. Lets routes fail with 503, not 500. */
export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Service-role access is only needed for erasure and breach bookkeeping. */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

/** Secret used to authenticate the scheduled erasure job. */
export function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

/**
 * Pepper for hashing IP addresses before storage. Not a secret we can invent:
 * if it is missing we still hash (never store raw IPs), but the stored hashes
 * are weaker, so deployments should set it.
 */
export function getIpHashPepper(): string {
  return process.env.IP_HASH_PEPPER ?? "forge-dev-pepper-change-me";
}
