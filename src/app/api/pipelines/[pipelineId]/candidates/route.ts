import type { NextRequest } from "next/server";
import { apiRoute, created, fail, ok, readJson } from "@/lib/api";
import { addCandidateToPipelineSchema, updatePipelineCandidateSchema } from "@/lib/validations";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";

/** /api/pipelines/<pipelineId>/candidates — pipeline id is the second-to-last segment. */
function pipelineIdFrom(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  return segments[segments.length - 2] ?? "";
}

/**
 * Adds a practitioner to one of the caller's pipelines.
 *
 * Two independent checks: RLS proves the pipeline belongs to the caller, and
 * the candidate must be visible in `profile_cards` (opted in). A recruiter
 * cannot use this endpoint to attach a private profile by guessing a UUID.
 */
export const POST = apiRoute(
  async ({ request, supabase, user, requestId, profile }) => {
    const pipelineId = pipelineIdFrom(request);
    const input = await readJson(request, addCandidateToPipelineSchema);

    if (input.pipelineId !== pipelineId) {
      return fail(400, "pipeline_mismatch", "Pipeline id does not match the route.");
    }

    const { data: pipeline } = await supabase
      .from("recruiter_pipelines")
      .select("id")
      .eq("id", pipelineId)
      .maybeSingle();

    if (!pipeline) {
      return fail(404, "pipeline_not_found", "That pipeline does not exist.");
    }

    const { data: candidate } = await supabase
      .from("profile_cards")
      .select("id")
      .eq("id", input.candidateId)
      .maybeSingle();

    if (!candidate) {
      return fail(404, "candidate_not_available", "That profile is not open to recruiter discovery.");
    }

    const { data: member, error } = await supabase
      .from("pipeline_candidates")
      .insert({
        pipeline_id: pipelineId,
        candidate_id: input.candidateId,
        stage: input.stage,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
      })
      .select("id, pipeline_id, candidate_id, stage, added_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return fail(409, "already_in_pipeline", "That candidate is already in this pipeline.");
      }
      return fail(500, "candidate_add_failed", "We could not add that candidate.", { requestId });
    }

    await logAuditEvent(supabase, user.id, {
      action: "pipeline_candidate_added",
      resourceType: "pipeline_candidates",
      resourceId: member.id,
      details: { pipelineId, stage: input.stage },
      ipHash: hashIp(requestIp(request.headers)),
      actorRole: profile.role,
    });

    return created({ candidate: member });
  },
  { roles: ["recruiter", "admin"], mutation: true }
);

/** Moves a candidate between pipeline stages. */
export const PATCH = apiRoute(
  async ({ request, supabase, user, requestId }) => {
    const pipelineId = pipelineIdFrom(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const candidateId = typeof body.candidateId === "string" ? body.candidateId : null;

    if (!candidateId) {
      return fail(400, "invalid_input", "candidateId is required.");
    }

    const input = updatePipelineCandidateSchema.safeParse(body);
    if (!input.success) {
      return fail(400, "invalid_input", "Some fields need attention.", input.error.issues);
    }

    const patch: Record<string, unknown> = {};
    if (input.data.stage !== undefined) patch.stage = input.data.stage;
    if (input.data.notes !== undefined) patch.notes = input.data.notes;
    if (input.data.tags !== undefined) patch.tags = input.data.tags;

    if (Object.keys(patch).length === 0) {
      return fail(400, "nothing_to_update", "Nothing to update.");
    }

    const { data, error } = await supabase
      .from("pipeline_candidates")
      .update(patch)
      .eq("pipeline_id", pipelineId)
      .eq("candidate_id", candidateId)
      .select("id, stage, notes, tags, updated_at")
      .maybeSingle();

    if (error || !data) {
      return fail(404, "candidate_not_found", "That candidate is not in this pipeline.", { requestId });
    }

    await logAuditEvent(supabase, user.id, {
      action: "pipeline_candidate_updated",
      resourceType: "pipeline_candidates",
      resourceId: data.id,
      details: { stage: data.stage },
      actorRole: "recruiter",
    });

    return ok({ candidate: data });
  },
  { roles: ["recruiter", "admin"], mutation: true }
);
