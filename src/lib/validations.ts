import { z } from "zod";

/**
 * Server-side validation for every mutating endpoint. Client forms reuse these
 * schemas only for immediate feedback; the server always re-validates.
 */

const passwordRules = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That password is too long")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");

const emailField = z
  .string()
  .trim()
  .min(3, "Enter your email")
  .max(254, "That email is too long")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

export const signUpSchema = z.object({
  email: emailField,
  password: passwordRules,
  role: z.enum(["practitioner", "recruiter"]).default("practitioner"),
  displayName: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(60, "Use 60 characters or fewer")
    .optional(),
  /** Required: the server refuses to create an account without consent. */
  acceptedRequiredConsent: z.literal(true, {
    message: "You must accept the Terms and Privacy Policy to create an account",
  }),
  recruiterDiscovery: z.boolean().default(false),
  productEmails: z.boolean().default(false),
  /** Sent so the client can be rejected if it renders an out-of-date policy. */
  policyVersion: z.string().min(1),
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password").max(200),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordRules,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------

export const startPracticeSessionSchema = z.object({
  challengeId: z.string().uuid("Invalid challenge ID"),
});

export const challengeAttemptSchema = z.object({
  challengeId: z.string().uuid("Invalid challenge ID"),
  /** Opened before the prompt was shown; proves how long the attempt took. */
  sessionId: z.string().uuid("Start a practice session first"),
  answer: z
    .string()
    .trim()
    .min(1, "Add your answer before submitting")
    .max(20000, "That answer is too long"),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

// ---------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------

export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Use at least 2 characters")
      .max(60, "Use 60 characters or fewer")
      .optional(),
    headline: z.string().trim().max(120, "Use 120 characters or fewer").optional(),
    bio: z.string().trim().max(500, "Use 500 characters or fewer").optional(),
    skills: z
      .array(z.string().trim().min(1).max(40))
      .max(20, "List up to 20 skills")
      .optional(),
    visibility: z.enum(["public", "recruiters_only", "private"]).optional(),
    allowRecruiterContact: z.boolean().optional(),
    companyName: z.string().trim().max(120, "Use 120 characters or fewer").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nothing to update",
  });

// ---------------------------------------------------------------------
// DPDP: consent, erasure, data principal requests
// ---------------------------------------------------------------------

export const consentUpdateSchema = z.object({
  purpose: z.enum([
    "recruiter_discovery",
    "product_emails",
    "analytics",
  ]),
  granted: z.boolean(),
});

export const deleteAccountSchema = z.object({
  /** Typed confirmation prevents accidental and CSRF-driven deletion. */
  confirmation: z.literal("DELETE MY ACCOUNT", {
    message: "Type DELETE MY ACCOUNT exactly to confirm",
  }),
  mode: z.enum(["grace_period", "immediate"]).default("grace_period"),
  reason: z
    .enum(["no_longer_needed", "privacy_concerns", "too_time_consuming", "found_alternative", "other"])
    .optional(),
  currentPassword: z.string().max(200).optional(),
});

export const dataRequestSchema = z.object({
  kind: z.enum(["access", "correction", "erasure", "grievance", "nomination"]),
  details: z.string().trim().min(10, "Add a little detail so we can act on it").max(2000),
});

// ---------------------------------------------------------------------
// Recruiter
// ---------------------------------------------------------------------

export const recruiterSearchSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  minStreak: z.number().int().min(0).max(3650).optional(),
  minAvgScore: z.number().int().min(0).max(100).optional(),
  category: z.string().trim().max(40).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const createPipelineSchema = z.object({
  name: z.string().trim().min(1, "Pipeline name is required").max(100),
  description: z.string().trim().max(500).optional(),
});

export const addCandidateToPipelineSchema = z.object({
  pipelineId: z.string().uuid("Invalid pipeline ID"),
  candidateId: z.string().uuid("Invalid candidate ID"),
  stage: z
    .enum(["new", "contacted", "screening", "interview", "offer", "rejected", "hired"])
    .default("new"),
  notes: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const updatePipelineCandidateSchema = z.object({
  stage: z
    .enum(["new", "contacted", "screening", "interview", "offer", "rejected", "hired"])
    .optional(),
  notes: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

// ---------------------------------------------------------------------
// Breach register (admin)
// ---------------------------------------------------------------------

export const breachEventSchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum([
    "unauthorized_access",
    "data_leak",
    "lost_device",
    "misconfiguration",
    "insider",
    "third_party",
    "other",
  ]),
  summary: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .refine((value) => !value.includes("@"), "Do not include personal data (email addresses) in the summary"),
  dataCategories: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  affectedUsersEstimate: z.number().int().min(0).max(100_000_000).optional(),
  occurredAtEstimate: z.string().datetime().optional(),
  containmentNotes: z.string().trim().max(4000).optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type StartPracticeSessionInput = z.infer<typeof startPracticeSessionSchema>;
export type ChallengeAttemptInput = z.infer<typeof challengeAttemptSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RecruiterSearchInput = z.infer<typeof recruiterSearchSchema>;
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type AddCandidateToPipelineInput = z.infer<typeof addCandidateToPipelineSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ConsentUpdateInput = z.infer<typeof consentUpdateSchema>;
export type DataRequestInput = z.infer<typeof dataRequestSchema>;
export type BreachEventInput = z.infer<typeof breachEventSchema>;
