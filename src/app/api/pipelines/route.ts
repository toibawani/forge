import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { createPipelineSchema } from "@/lib/validations";
import { requireRole } from "@/lib/auth-helpers";
import { logAuditEvent } from "@/lib/audit-logger";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 503 });
    }

    const currentUser = await requireRole(["recruiter", "admin"]);

    const supabase = createClient();

    const { data: pipelines, error } = await supabase
      .from("recruiter_pipelines")
      .select(`
        *,
        pipeline_candidates (
          id,
          candidate_id,
          stage,
          added_at,
          profiles (
            id,
            display_name,
            email,
            skills
          )
        )
      `)
      .eq("recruiter_id", currentUser.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch pipelines", { error: error.message }, currentUser.user.id, requestId);
      return NextResponse.json({ error: "Failed to fetch pipelines" }, { status: 500 });
    }

    return NextResponse.json({ pipelines }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.error("Unexpected error in pipelines GET", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 503 });
    }

    const currentUser = await requireRole(["recruiter", "admin"]);

    const body = await request.json();
    const validationResult = createPipelineSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid input", details: validationResult.error.issues }, { status: 400 });
    }

    const supabase = createClient();

    const { data: pipeline, error } = await supabase
      .from("recruiter_pipelines")
      .insert({
        recruiter_id: currentUser.user.id,
        ...validationResult.data,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create pipeline", { error: error.message }, currentUser.user.id, requestId);
      return NextResponse.json({ error: "Failed to create pipeline" }, { status: 500 });
    }

    await logAuditEvent(
      currentUser.user.id,
      "create_pipeline",
      "recruiter_pipelines",
      pipeline.id,
      { name: pipeline.name },
      ip
    );

    logger.info("Pipeline created successfully", { pipelineId: pipeline.id }, currentUser.user.id, requestId);

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.error("Unexpected error in pipelines POST", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
