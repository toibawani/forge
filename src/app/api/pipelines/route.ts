import { apiRoute, created, fail, ok, readJson } from "@/lib/api";
import { createPipelineSchema } from "@/lib/validations";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";

/** The signed-in recruiter's own pipelines. RLS enforces ownership as well. */
export const GET = apiRoute(
  async ({ supabase, user }) => {
    const { data: pipelines, error } = await supabase
      .from("recruiter_pipelines")
      .select("id, name, description, created_at")
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return fail(500, "pipelines_unavailable", "We could not load your pipelines.");
    }

    const pipelineIds = (pipelines ?? []).map((pipeline) => pipeline.id);
    if (pipelineIds.length === 0) {
      return ok({ pipelines: [] });
    }

    const { data: members } = await supabase
      .from("pipeline_candidates")
      .select("id, pipeline_id, candidate_id, stage, notes, tags, added_at")
      .in("pipeline_id", pipelineIds);

    const candidateIds = Array.from(new Set((members ?? []).map((member) => member.candidate_id)));

    const { data: cards } = candidateIds.length
      ? await supabase
          .from("profile_cards")
          .select("id, display_name, headline, skills, current_streak, longest_streak")
          .in("id", candidateIds)
      : { data: [] as Array<Record<string, unknown>> };

    const cardById = new Map((cards ?? []).map((card) => [card.id, card]));

    return ok({
      pipelines: (pipelines ?? []).map((pipeline) => ({
        ...pipeline,
        candidates: (members ?? [])
          .filter((member) => member.pipeline_id === pipeline.id)
          .map((member) => ({ ...member, candidate: cardById.get(member.candidate_id) ?? null })),
      })),
    });
  },
  { roles: ["recruiter", "admin"] }
);

export const POST = apiRoute(
  async ({ request, supabase, user, requestId, profile }) => {
    const input = await readJson(request, createPipelineSchema);

    const { data: pipeline, error } = await supabase
      .from("recruiter_pipelines")
      .insert({
        recruiter_id: user.id,
        name: input.name,
        description: input.description ?? null,
      })
      .select("id, name, description, created_at")
      .single();

    if (error) {
      return fail(500, "pipeline_create_failed", "We could not create that pipeline.", { requestId });
    }

    await logAuditEvent(supabase, user.id, {
      action: "pipeline_created",
      resourceType: "recruiter_pipelines",
      resourceId: pipeline.id,
      details: { name: input.name },
      ipHash: hashIp(requestIp(request.headers)),
      actorRole: profile.role,
    });

    return created({ pipeline });
  },
  { roles: ["recruiter", "admin"], mutation: true }
);
