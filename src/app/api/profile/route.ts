import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { updateProfileSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.warn("Supabase not configured for profile GET", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Authentication service not configured" },
        { status: 503 }
      );
    }

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("Unauthorized profile access attempt", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      logger.error("Failed to fetch profile", { error: error.message }, user.id, requestId);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    logger.info("Profile fetched successfully", undefined, user.id, requestId);

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    logger.error("Unexpected error in profile GET", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.warn("Supabase not configured for profile PATCH", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Authentication service not configured" },
        { status: 503 }
      );
    }

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("Unauthorized profile update attempt", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = updateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid profile update input", { errors: validationResult.error.issues }, user.id, requestId);
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(validationResult.data)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update profile", { error: error.message }, user.id, requestId);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    logger.info("Profile updated successfully", undefined, user.id, requestId);

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    logger.error("Unexpected error in profile PATCH", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
