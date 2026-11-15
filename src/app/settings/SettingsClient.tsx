"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { GRIEVANCE_OFFICER, type ConsentItem } from "@/lib/consent";

type ProfileState = {
  displayName: string;
  headline: string;
  bio: string;
  skills: string;
  visibility: "private" | "recruiters_only" | "public";
  allowRecruiterContact: boolean;
  companyName: string;
};

type ConsentRow = {
  purpose: string;
  granted: boolean;
  grantedAt: string | null;
  withdrawnAt: string | null;
};

type ScheduledDeletion = { scheduledFor: string; mode: string } | null;

const REASONS = [
  { value: "", label: "Prefer not to say" },
  { value: "no_longer_needed", label: "I no longer need it" },
  { value: "privacy_concerns", label: "Privacy concerns" },
  { value: "too_time_consuming", label: "Takes too much time" },
  { value: "found_alternative", label: "Using something else" },
  { value: "other", label: "Something else" },
];

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-card-border pt-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {caption ? <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{caption}</p> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
          checked ? "border-primary bg-primary" : "border-card-border bg-foreground/10"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SettingsClient({
  email,
  memberSince,
  initialProfile,
  consentPurposes,
  policyVersion,
  consents,
  scheduledDeletion,
  recentRequests,
}: {
  email: string;
  memberSince: string | null;
  initialProfile: ProfileState;
  consentPurposes: ConsentItem[];
  policyVersion: string;
  consents: ConsentRow[];
  scheduledDeletion: ScheduledDeletion;
  recentRequests: Array<{ id: string; kind: string; status: string; createdAt: string }>;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState>(initialProfile);
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [consentRows, setConsentRows] = useState<ConsentRow[]>(consents);
  const [consentError, setConsentError] = useState<string | null>(null);

  const [requestKind, setRequestKind] = useState("access");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"grace_period" | "immediate">("grace_period");
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleteState, setDeleteState] = useState<"idle" | "working" | "error" | "done">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const grantedByPurpose = new Map(consentRows.map((row) => [row.purpose, row]));

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileState("saving");
    setProfileError(null);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: profile.displayName.trim() || undefined,
        headline: profile.headline.trim(),
        bio: profile.bio.trim(),
        skills: profile.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        visibility: profile.visibility,
        allowRecruiterContact: profile.allowRecruiterContact,
        companyName: profile.companyName.trim(),
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      const payload = await response?.json().catch(() => null);
      setProfileError(payload?.error?.message ?? "We could not save those changes.");
      setProfileState("error");
      return;
    }

    setProfileState("saved");
    router.refresh();
  }

  async function updateConsent(purpose: string, granted: boolean) {
    setConsentError(null);
    const previous = consentRows;
    setConsentRows((rows) => {
      const next = rows.filter((row) => row.purpose !== purpose);
      return [...next, { purpose, granted, grantedAt: granted ? new Date().toISOString() : null, withdrawnAt: granted ? null : new Date().toISOString() }];
    });

    const response = await fetch("/api/account/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, granted }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setConsentRows(previous);
      setConsentError("That change did not save. Reload and try again.");
      return;
    }

    router.refresh();
  }

  async function submitDataRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestMessage(null);

    const response = await fetch("/api/account/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: requestKind, details: requestDetails }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    if (!response || !response.ok) {
      setRequestMessage(payload?.error?.message ?? "We could not record that request.");
      return;
    }

    setRequestDetails("");
    setRequestMessage("Request recorded. The grievance officer responds within 30 days.");
    router.refresh();
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteState("working");
    setDeleteError(null);

    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmation: confirmation.trim(),
        mode: deleteMode,
        reason: deleteReason || undefined,
      }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    if (!response || !response.ok) {
      setDeleteError(payload?.error?.message ?? "We could not process that request.");
      setDeleteState("error");
      return;
    }

    if (payload?.status === "deleted") {
      router.replace("/?deleted=1");
      router.refresh();
      return;
    }

    setDeleteState("done");
    router.refresh();
  }

  async function cancelDeletion() {
    setDeleteState("working");
    const response = await fetch("/api/account/delete/cancel", { method: "POST" }).catch(() => null);
    if (!response || !response.ok) {
      setDeleteError("We could not cancel the request. Contact the grievance officer.");
      setDeleteState("error");
      return;
    }
    setDeleteState("idle");
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={eyebrowStyles}>Settings</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">Your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {email} · member since {formatDate(memberSince)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className={buttonStyles("secondary", "sm")}>
            Dashboard
          </Link>
          <button type="button" onClick={signOut} className={buttonStyles("ghost", "sm")}>
            Sign out
          </button>
        </div>
      </header>

      {scheduledDeletion ? (
        <div className="mt-8">
          <Alert tone="warning" title="Account scheduled for deletion">
            Your record will be permanently erased on{" "}
            <strong className="font-medium">{formatDate(scheduledDeletion.scheduledFor)}</strong>. Until then the
            account is frozen.{" "}
            <button
              type="button"
              onClick={cancelDeletion}
              className="font-medium text-primary underline underline-offset-4"
            >
              Cancel deletion
            </button>
            .
          </Alert>
        </div>
      ) : null}

      {deleteState === "done" ? (
        <div className="mt-8">
          <Alert tone="success" title="Deletion scheduled">
            We have frozen the account and queued the erasure. You can change your mind until the scheduled
            date.
          </Alert>
        </div>
      ) : null}

      <Section title="Profile" caption="Shown on your record">
        <form onSubmit={saveProfile} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="displayName" label="Name">
              <TextInput
                id="displayName"
                value={profile.displayName}
                onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                placeholder="Ananya Rao"
              />
            </Field>

            <Field id="headline" label="Headline" optional hint="One line: what you do.">
              <TextInput
                id="headline"
                value={profile.headline}
                onChange={(event) => setProfile({ ...profile, headline: event.target.value })}
                placeholder="Backend engineer, distributed systems"
              />
            </Field>
          </div>

          <Field id="bio" label="Bio" optional hint={`${profile.bio.length}/500 characters`}>
            <TextArea
              id="bio"
              rows={4}
              value={profile.bio}
              onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
              placeholder="What you are working on, and what you want to get better at."
            />
          </Field>

          <Field
            id="skills"
            label="Skills"
            hint="Comma separated. These are claims — your scores are the evidence."
          >
            <TextInput
              id="skills"
              value={profile.skills}
              onChange={(event) => setProfile({ ...profile, skills: event.target.value })}
              placeholder="typescript, postgres, system design"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="visibility"
              label="Who can see your record"
              hint="Recruiter-only keeps you out of public view."
            >
              <Select
                id="visibility"
                value={profile.visibility}
                onChange={(event) =>
                  setProfile({ ...profile, visibility: event.target.value as ProfileState["visibility"] })
                }
              >
                <option value="private">Private — only me</option>
                <option value="recruiters_only">Verified recruiters only</option>
                <option value="public">Public</option>
              </Select>
            </Field>

            <Field id="companyName" label="Company" optional>
              <TextInput
                id="companyName"
                value={profile.companyName}
                onChange={(event) => setProfile({ ...profile, companyName: event.target.value })}
                placeholder="Where you work"
              />
            </Field>
          </div>

          <div className="border-t border-card-border pt-5">
            <Toggle
              checked={profile.allowRecruiterContact}
              onChange={(next) => setProfile({ ...profile, allowRecruiterContact: next })}
              label="Allow recruiters to contact me"
              description="Your email stays hidden; recruiters reach you through Forge."
            />
          </div>

          {profileError ? <Alert tone="error">{profileError}</Alert> : null}
          {profileState === "saved" ? <Alert tone="success">Saved.</Alert> : null}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={profileState === "saving"} className={buttonStyles("primary", "md")}>
              {profileState === "saving" ? "Saving…" : "Save changes"}
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              Stored in Postgres, RLS-protected
            </span>
          </div>
        </form>
      </Section>

      {/* Anchor target for the unsubscribe link in email: consent lives here. */}
      <span id="emails" className="block scroll-mt-24" />

      <Section title="Consent" caption={`Policy version ${policyVersion}`}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Consent is recorded per purpose, with the policy version and the time you gave it. Required items
          keep the product working; optional items are off unless you turn them on.
        </p>

        <div className="mt-5 divide-y divide-card-border border-y border-card-border">
          {consentPurposes.map((item) => {
            const row = grantedByPurpose.get(item.purpose);
            const granted = row?.granted ?? (item.required && Boolean(grantedByPurpose.size));

            return (
              <div key={item.purpose} className="flex items-start justify-between gap-6 py-4">
                <div className="max-w-md">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {granted
                      ? `granted ${formatDate(row?.grantedAt ?? null)}`
                      : row?.withdrawnAt
                        ? `withdrawn ${formatDate(row.withdrawnAt)}`
                        : "not granted"}
                  </p>
                </div>

                {item.required ? (
                  <span className="shrink-0 rounded border border-card-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    required
                  </span>
                ) : (
                  <Toggle
                    checked={Boolean(granted)}
                    onChange={(next) => updateConsent(item.purpose, next)}
                    label={item.label}
                  />
                )}
              </div>
            );
          })}
        </div>

        {consentError ? (
          <div className="mt-4">
            <Alert tone="error">{consentError}</Alert>
          </div>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Required consents cannot be switched off while the account exists — that is the trade for a working
          record. Deleting your account is the way to stop processing entirely.
        </p>
      </Section>

      <Section title="Your data" caption="DPDP rights">
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/api/export?format=json" className={buttonStyles("secondary", "md", "justify-between")}>
            Export everything (JSON)
            <span className="font-mono text-[10px] text-muted">download</span>
          </a>
          <a href="/api/export?format=csv" className={buttonStyles("secondary", "md", "justify-between")}>
            Export practice record (CSV)
            <span className="font-mono text-[10px] text-muted">download</span>
          </a>
        </div>

        <form onSubmit={submitDataRequest} className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <Field id="requestKind" label="Request type">
              <Select id="requestKind" value={requestKind} onChange={(event) => setRequestKind(event.target.value)}>
                <option value="access">Access my data</option>
                <option value="correction">Correct my data</option>
                <option value="erasure">Erase my data</option>
                <option value="grievance">Raise a grievance</option>
                <option value="nomination">Nominate someone</option>
              </Select>
            </Field>

            <Field id="requestDetails" label="Details" hint="No passwords or identity documents here, please.">
              <TextArea
                id="requestDetails"
                rows={3}
                value={requestDetails}
                onChange={(event) => setRequestDetails(event.target.value)}
                placeholder="What should we look at?"
                required
                minLength={10}
              />
            </Field>
          </div>

          {requestMessage ? (
            <Alert tone={requestMessage.startsWith("Request recorded") ? "success" : "error"}>{requestMessage}</Alert>
          ) : null}

          <button type="submit" className={buttonStyles("secondary", "md")}>
            Submit request
          </button>
        </form>

        {recentRequests.length > 0 ? (
          <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
            {recentRequests.map((request) => (
              <li key={request.id} className="flex justify-between border-b border-card-border pb-2">
                <span className="capitalize">{request.kind}</span>
                <span className="font-mono uppercase tracking-[0.08em]">
                  {request.status} · {formatDate(request.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Grievance officer: {GRIEVANCE_OFFICER.role},{" "}
          <a href={`mailto:${GRIEVANCE_OFFICER.email}`} className="underline underline-offset-2">
            {GRIEVANCE_OFFICER.email}
          </a>
          , {GRIEVANCE_OFFICER.region}. Response within {GRIEVANCE_OFFICER.responseWindowDays} days.
        </p>
      </Section>

      <Section title="Delete account" caption="Right to erasure">
        <p className="text-sm leading-relaxed text-muted-foreground">
          This removes your profile, practice record, streaks, consent register and any recruiter notes about
          you. It cannot be undone. Choose a 30-day grace period, or delete immediately.
        </p>

        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className={buttonStyles("secondary", "md", "mt-5 border-destructive/40 text-destructive hover:bg-destructive/[0.04]")}
          >
            Delete my account
          </button>
        ) : (
          <form onSubmit={deleteAccount} className="mt-5 space-y-5 rounded border border-destructive/30 bg-destructive/[0.02] p-5">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">When should it happen?</legend>

              <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="deleteMode"
                  value="grace_period"
                  checked={deleteMode === "grace_period"}
                  onChange={() => setDeleteMode("grace_period")}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="font-medium text-foreground">In 30 days</span> — the account freezes now and
                  erases on the scheduled date. You can cancel until then.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="radio"
                  name="deleteMode"
                  value="immediate"
                  checked={deleteMode === "immediate"}
                  onChange={() => setDeleteMode("immediate")}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="font-medium text-foreground">Immediately</span> — erased now. You will be
                  signed out and cannot recover the record.
                </span>
              </label>
            </fieldset>

            <Field id="deleteReason" label="Reason" optional hint="Used only in aggregate to improve the product.">
              <Select id="deleteReason" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)}>
                {REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              id="confirmation"
              label="Type DELETE MY ACCOUNT to confirm"
              hint="This is the only confirmation step. There is no undo."
            >
              <TextInput
                id="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="DELETE MY ACCOUNT"
                autoComplete="off"
              />
            </Field>

            {deleteError ? <Alert tone="error">{deleteError}</Alert> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={confirmation.trim() !== "DELETE MY ACCOUNT" || deleteState === "working"}
                className={buttonStyles("danger", "md")}
              >
                {deleteState === "working" ? "Working…" : deleteMode === "immediate" ? "Delete permanently" : "Schedule deletion"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                  setConfirmation("");
                  setDeleteState("idle");
                  setDeleteError(null);
                }}
                className={buttonStyles("ghost", "md")}
              >
                Keep my account
              </button>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              An accountability record is kept showing that an erasure happened, using a one-way hash. It
              contains no name, email or practice data.
            </p>
          </form>
        )}
      </Section>

      <footer className="mt-12 flex flex-wrap gap-5 border-t border-card-border pt-6 text-xs text-muted">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/privacy/hindi" className="hover:text-foreground">
          गोपनीयता नीति
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </footer>
    </div>
  );
}
