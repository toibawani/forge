import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";

/**
 * Handles the email link Supabase sends after sign up / password reset.
 * Only same-app paths are accepted as a redirect target.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const { appUrl } = getPublicEnv();

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", appUrl));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=not_configured", appUrl));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=link_expired", appUrl));
  }

  return NextResponse.redirect(new URL(next, appUrl));
}
