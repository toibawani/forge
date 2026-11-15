import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health";

/**
 * Deployment health for uptime monitors.
 *
 * Unauthenticated on purpose, and deliberately boring: booleans and codes, never
 * configuration values, keys, counts or user data.
 */
export async function GET() {
  const report = await checkHealth();
  const status = report.status === "down" ? 503 : report.status === "unconfigured" ? 503 : 200;

  return NextResponse.json(report, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
