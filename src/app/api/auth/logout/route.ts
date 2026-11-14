import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.warn("Supabase not configured for logout", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Authentication service not configured" },
        { status: 503 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error("Logout failed", { error: error.message }, undefined, requestId);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    logger.info("User logged out successfully", undefined, undefined, requestId);

    return NextResponse.json(
      { message: "Logout successful" },
      { status: 200 }
    );
  } catch (error) {
    logger.error("Unexpected error in logout", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
