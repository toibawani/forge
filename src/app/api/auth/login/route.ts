import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { signInSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.warn("Supabase not configured for login", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Authentication service not configured" },
        { status: 503 }
      );
    }

    // Rate limiting
    const rateLimitResult = rateLimit(ip, 10, 300000); // 10 requests per 5 minutes
    if (!rateLimitResult.success) {
      logger.warn("Rate limit exceeded for login", { ip }, undefined, requestId);
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = signInSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid login input", { errors: validationResult.error.issues }, undefined, requestId);
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.warn("Login failed", { error: error.message }, undefined, requestId);
      // Generic error message to avoid account enumeration
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    logger.info("User logged in successfully", { email }, data.user?.id, requestId);

    return NextResponse.json(
      {
        message: "Login successful",
        user: { id: data.user?.id, email: data.user?.email },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Unexpected error in login", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
