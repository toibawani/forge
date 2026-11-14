import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { signUpSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.warn("Supabase not configured for signup", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Authentication service not configured" },
        { status: 503 }
      );
    }

    // Rate limiting
    const rateLimitResult = rateLimit(ip, 5, 3600000); // 5 requests per hour
    if (!rateLimitResult.success) {
      logger.warn("Rate limit exceeded for signup", { ip }, undefined, requestId);
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = signUpSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid signup input", { errors: validationResult.error.issues }, undefined, requestId);
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { email, password, role } = validationResult.data;

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          role,
        },
      },
    });

    if (error) {
      logger.error("Signup failed", { error: error.message }, undefined, requestId);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    logger.info("User signed up successfully", { email }, data.user?.id, requestId);

    return NextResponse.json(
      {
        message: "Signup successful. Please check your email to confirm your account.",
        user: { id: data.user?.id, email: data.user?.email },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Unexpected error in signup", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
