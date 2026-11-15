import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { CONSENT_ITEMS, POLICY_VERSION } from "@/lib/consent";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Settings — Forge",
  description: "Your profile, consent choices, data export and account deletion.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/settings");

  const { supabase, user } = session;

  const [profileResult, consentsResult, deletionResult, requestsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, headline, bio, skills, visibility, allow_recruiter_contact, company_name, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_consents")
      .select("purpose, granted, policy_version, granted_at, withdrawn_at")
      .eq("user_id", user.id),
    supabase
      .from("account_deletions")
      .select("id, mode, status, requested_at, scheduled_for")
      .eq("user_id", user.id)
      .eq("status", "scheduled")
      .maybeSingle(),
    supabase
      .from("data_requests")
      .select("id, kind, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const profile = profileResult.data;

  return (
    <SettingsClient
      email={user.email ?? ""}
      memberSince={profile?.created_at ?? null}
      initialProfile={{
        displayName: profile?.display_name ?? "",
        headline: profile?.headline ?? "",
        bio: profile?.bio ?? "",
        skills: (profile?.skills ?? []).join(", "),
        visibility: (profile?.visibility ?? "private") as "private" | "recruiters_only" | "public",
        allowRecruiterContact: profile?.allow_recruiter_contact ?? false,
        companyName: profile?.company_name ?? "",
      }}
      consentPurposes={CONSENT_ITEMS}
      policyVersion={POLICY_VERSION}
      consents={(consentsResult.data ?? []).map((row) => ({
        purpose: row.purpose as string,
        granted: Boolean(row.granted),
        grantedAt: row.granted_at as string | null,
        withdrawnAt: row.withdrawn_at as string | null,
      }))}
      scheduledDeletion={
        deletionResult.data
          ? {
              scheduledFor: deletionResult.data.scheduled_for as string,
              mode: deletionResult.data.mode as string,
            }
          : null
      }
      recentRequests={(requestsResult.data ?? []).map((row) => ({
        id: row.id as string,
        kind: row.kind as string,
        status: row.status as string,
        createdAt: row.created_at as string,
      }))}
    />
  );
}
