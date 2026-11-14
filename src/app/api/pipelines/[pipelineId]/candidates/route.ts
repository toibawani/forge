import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { addCandidateToPipelineSchema, updatePipelineCandidateSchema } from "@/lib/validations";
import { requireRole } from "@/lib/auth-helpers";
import { logAuditEvent } from "@/lib/audit-logger";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest, context: { params: Promise<{ pipelineId: string }> }) {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const { pipelineId } = await context.params;

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 503 });
    }

    const currentUser = await requireRole(["recruiter", "admin"]);

    const body = await request.json();
    const validationResult = addCandidateToPipelineSchema.safeParse({ ...body, pipelineId });

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid input", details: validationResult.error.issues }, { status: 400 });
    }

    const supabase = createClient();

    const { data: pipeline, error: pipelineError } = await supabase
      .from("recruiter_pipelines")
      .select("recruiter_id")
      .eq("id", pipelineId)
      .single();

    if (pipelineError || !pipeline || pipeline.recruiter_id !== currentUser.user.id) {
      return NextResponse.json({ error: "Pipeline not found or access denied" }, { status: 404 });
    }

    const { data: candidate, error } = await supabase
      .from("pipeline_candidates")
      .insert({
        pipeline_id: pipelineId,
        candidate_id: validationResult.data.candidateId,
        stage: validationResult.data.stage,
        notes: validationResult.data.notes,
        tags: validationResult.data.tags,
      })
      .select(`
        *,
        profiles (
          id,
          display_name,
          email,
          skills
        )
      `)
      .single();

    if (error) {
      logger.error("Failed to add candidate to pipeline", { error: error.message }, currentUser.user.id, requestId);
      return NextResponse.json({ error: "Failed to add candidate" }, { status: 500 });
    }

    await logAuditEvent(
      currentUser.user.id,
      "add_candidate_to_pipeline",
      "pipeline_candidates",
      candidate.id,
      { pipelineId, candidateId: validationResult.data.candidateId },
      ip
    );

    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.error("Unexpected error adding candidate", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
