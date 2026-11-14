import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                request.cookies.set(name, value);
              });
            },
          },
        }
      );

      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch (error) {
      // If Supabase client creation fails, continue without auth
      console.warn("Supabase client creation failed:", error);
    }
  }

  // Log request
  const duration = Date.now() - start;
  logger.info(
    `${request.method} ${request.nextUrl.pathname}`,
    {
      duration,
      userAgent: request.headers.get("user-agent"),
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    },
    user?.id,
    requestId
  );

  // Protected routes check (only enforce if Supabase is configured)
  const protectedPaths = ["/dashboard", "/api/protected"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user && supabaseUrl && supabaseAnonKey) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
