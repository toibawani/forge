import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { requireRole } from "@/lib/auth-helpers";
import { logAuditEvent } from "@/lib/audit-logger";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 503 });
    }

    const currentUser = await requireRole(["recruiter", "admin", "practitioner"]);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    const supabase = createClient();

    if (currentUser.profile?.role === "practitioner") {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
          *,
          streaks (*),
          challenge_attempts (*)
        `)
        .eq("id", currentUser.user.id)
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
      }

      await logAuditEvent(currentUser.user.id, "export_data", "profiles", currentUser.user.id, { format }, ip);

      if (format === "json") {
        return NextResponse.json(profile, { status: 200 });
      }

      if (format === "csv") {
        const csv = convertToCSV(profile);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="forge-data-${currentUser.user.id}.csv"`,
          },
        });
      }
    }

    if (currentUser.profile?.role === "recruiter" || currentUser.profile?.role === "admin") {
      const { data: pipelines, error } = await supabase
        .from("recruiter_pipelines")
        .select(`
          *,
          pipeline_candidates (
            *,
            profiles (*)
          )
        `)
        .eq("recruiter_id", currentUser.user.id);

      if (error) {
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
      }

      await logAuditEvent(currentUser.user.id, "export_pipelines", "recruiter_pipelines", undefined, { format }, ip);

      if (format === "json") {
        return NextResponse.json(pipelines, { status: 200 });
      }

      if (format === "csv") {
        const csv = convertPipelinesToCSV(pipelines);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="forge-pipelines-${currentUser.user.id}.csv"`,
          },
        });
      }
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Unexpected error in export", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

function convertToCSV(data: any): string {
  const headers = Object.keys(data).join(",");
  const values = Object.values(data).map((v) => JSON.stringify(v)).join(",");
  return `${headers}\n${values}`;
}

function convertPipelinesToCSV(pipelines: any[]): string {
  if (!pipelines || pipelines.length === 0) return "pipeline_id,name,description,candidate_count\n";

  const headers = "pipeline_id,name,description,candidate_count";
  const rows = pipelines.map((p) => 
    `${p.id},"${p.name}","${p.description || ""}",${p.pipeline_candidates?.length || 0}`
  );
  return `${headers}\n${rows.join("\n")}`;
}
