/**
 * Consent copy and DPDP constants.
 *
 * Kept free of server-only imports so the signup form can render the exact
 * same wording the server records — the notice a person sees and the consent
 * we store must never drift apart.
 */

export const POLICY_VERSION = "2026-11-15";

/** Days a user has to change their mind before erasure runs. */
export const DELETION_GRACE_DAYS = 30;

export const GRIEVANCE_OFFICER = {
  role: "Grievance Officer",
  email: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL ?? "grievance@forge.app",
  region: "Bengaluru, Karnataka, India",
  /** DPDP: a data principal must get a response within a reasonable period. */
  responseWindowDays: 30,
} as const;

export type ConsentPurpose =
  | "terms"
  | "privacy"
  | "core_processing"
  | "recruiter_discovery"
  | "product_emails"
  | "analytics";

export type ConsentItem = {
  purpose: ConsentPurpose;
  label: string;
  description: string;
  required: boolean;
  /** Optional purposes default to off: consent has to be an active choice. */
  defaultGranted: boolean;
};

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    purpose: "terms",
    label: "I accept the Terms of Service",
    description:
      "The rules of using Forge: one account per person, honest practice submissions, and the limits of what Forge promises.",
    required: true,
    defaultGranted: true,
  },
  {
    purpose: "privacy",
    label: "I have read the Privacy Policy",
    description:
      "Plain-English detail on what we collect, why, how long we keep it, and how to get it deleted. Also available in Hindi.",
    required: true,
    defaultGranted: true,
  },
  {
    purpose: "core_processing",
    label: "Store my practice record",
    description:
      "Your attempts, scores and streaks are stored to build the time-stamped record recruiters can verify. Without this, Forge cannot work.",
    required: true,
    defaultGranted: true,
  },
  {
    purpose: "recruiter_discovery",
    label: "Let verified recruiters find me",
    description:
      "Recruiters can see your skills, consistency and scores, and contact you. Your email is never shown. You can turn this off any time.",
    required: false,
    defaultGranted: false,
  },
  {
    purpose: "product_emails",
    label: "Send me occasional product email",
    description:
      "Streak reminders and product changes. No third-party marketing, ever. Unsubscribe from any email.",
    required: false,
    defaultGranted: false,
  },
  {
    purpose: "analytics",
    label: "Privacy-preserving product analytics",
    description:
      "Aggregated, non-identifying usage data so we know which challenges help people improve. Off by default.",
    required: false,
    defaultGranted: false,
  },
];

export const REQUIRED_CONSENT_PURPOSES = CONSENT_ITEMS.filter((item) => item.required).map(
  (item) => item.purpose
);

export const OPTIONAL_CONSENT_PURPOSES = CONSENT_ITEMS.filter((item) => !item.required).map(
  (item) => item.purpose
);

export function isConsentPurpose(value: string): value is ConsentPurpose {
  return CONSENT_ITEMS.some((item) => item.purpose === value);
}
