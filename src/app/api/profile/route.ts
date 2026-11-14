import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { updateProfileSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { logAuditEvent } from "@/lib/audit-logger";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Authentication service not configured" }, { status: 503 });
    }

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(`
        *,
        streaks (
          current_streak,
          longest_streak,
          total_practice_days,
          last_practice_date
        )
      `)
      .eq("id", user.id)
      .single();

    if (error) {
      logger.error("Failed to fetch profile", { error: error.message }, user.id, requestId);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    logger.info("Profile fetched successfully", undefined, user.id, requestId);

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    logger.error("Unexpected error in profile GET", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Authentication service not configured" }, { status: 503 });
    }

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const validationResult = updateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid profile update input", { errors: validationResult.error.issues }, user.id, requestId);
      return NextResponse.json({ error: "Invalid input", details: validationResult.error.issues }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(validationResult.data)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update profile", { error: error.message }, user.id, requestId);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    await logAuditEvent(
      user.id,
      "update_profile",
      "profiles",
      user.id,
      { updates: validationResult.data },
      ip
    );

    logger.info("Profile updated successfully", undefined, user.id, requestId);

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    logger.error("Unexpected error in profile PATCH", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
