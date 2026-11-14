import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { challengeAttemptSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.warn("Supabase not configured for challenges GET", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Database service not configured" },
        { status: 503 }
      );
    }

    const supabase = createClient();

    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get("difficulty");
    const category = searchParams.get("category");

    let query = supabase
      .from("challenges")
      .select("*")
      .eq("is_active", true);

    if (difficulty) {
      query = query.eq("difficulty", difficulty);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const { data: challenges, error } = await query;

    if (error) {
      logger.error("Failed to fetch challenges", { error: error.message }, undefined, requestId);
      return NextResponse.json(
        { error: "Failed to fetch challenges" },
        { status: 500 }
      );
    }

    logger.info("Challenges fetched successfully", { count: challenges?.length }, undefined, requestId);

    return NextResponse.json({ challenges }, { status: 200 });
  } catch (error) {
    logger.error("Unexpected error in challenges GET", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.warn("Supabase not configured for challenges POST", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Database service not configured" },
        { status: 503 }
      );
    }

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("Unauthorized challenge attempt", undefined, undefined, requestId);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = challengeAttemptSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid challenge attempt input", { errors: validationResult.error.issues }, user.id, requestId);
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { challengeId, answer, timeSpent, idempotencyKey } = validationResult.data;

    // Verify challenge exists
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      logger.warn("Challenge not found", { challengeId }, user.id, requestId);
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    // Calculate score (simplified - in production, use actual grading logic)
    const score = Math.floor(Math.random() * 40) + 60; // 60-100 range for demo

    // Record attempt with idempotency
    const { data: attempt, error: attemptError } = await supabase
      .from("challenge_attempts")
      .insert({
        user_id: user.id,
        challenge_id: challengeId,
        submission: { answer },
        score,
        time_spent_seconds: timeSpent,
        status: "completed",
        idempotency_key: idempotencyKey,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
      .select()
      .single();

    if (attemptError) {
      logger.error("Failed to record challenge attempt", { error: attemptError.message }, user.id, requestId);
      return NextResponse.json(
        { error: "Failed to record attempt" },
        { status: 500 }
      );
    }

    logger.info("Challenge attempt recorded successfully", { challengeId, score }, user.id, requestId);

    return NextResponse.json(
      { attempt, score },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Unexpected error in challenges POST", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
