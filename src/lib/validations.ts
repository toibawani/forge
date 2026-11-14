import { z } from "zod";

// Auth validation schemas
export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  role: z.enum(["practitioner", "recruiter"]).default("practitioner"),
});

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Challenge validation schemas
export const challengeAttemptSchema = z.object({
  challengeId: z.string().uuid("Invalid challenge ID"),
  answer: z.string().min(1, "Answer is required"),
  timeSpent: z.number().int().positive("Time spent must be a positive integer"),
  idempotencyKey: z.string().optional(),
});

export const challengeSubmissionSchema = z.object({
  challengeId: z.string().uuid("Invalid challenge ID"),
  submission: z.any(),
  metadata: z
    .object({
      language: z.string().optional(),
      framework: z.string().optional(),
    })
    .optional(),
});

// Profile validation schemas
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be less than 50 characters")
    .optional(),
  bio: z
    .string()
    .max(500, "Bio must be less than 500 characters")
    .optional(),
  skills: z.array(z.string()).optional(),
  visibility: z.enum(["public", "private", "recruiters_only"]).optional(),
  allowRecruiterContact: z.boolean().optional(),
  companyName: z.string().optional(),
});

// Recruiter search validation schemas
export const recruiterSearchSchema = z.object({
  skills: z.array(z.string()).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  category: z.string().optional(),
  minStreak: z.number().int().min(0).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  timeFrame: z.enum(["week", "month", "year", "all"]).optional(),
  visibility: z.enum(["public", "recruiters_only"]).default("public"),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Pipeline validation schemas
export const createPipelineSchema = z.object({
  name: z.string().min(1, "Pipeline name is required").max(100),
  description: z.string().max(500).optional(),
});

export const addCandidateToPipelineSchema = z.object({
  pipelineId: z.string().uuid("Invalid pipeline ID"),
  candidateId: z.string().uuid("Invalid candidate ID"),
  stage: z.enum(["new", "contacted", "screening", "interview", "offer", "rejected", "hired"]).default("new"),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

export const updatePipelineCandidateSchema = z.object({
  stage: z.enum(["new", "contacted", "screening", "interview", "offer", "rejected", "hired"]).optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

// Type exports
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChallengeAttemptInput = z.infer<typeof challengeAttemptSchema>;
export type ChallengeSubmissionInput = z.infer<typeof challengeSubmissionSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RecruiterSearchInput = z.infer<typeof recruiterSearchSchema>;
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type AddCandidateToPipelineInput = z.infer<typeof addCandidateToPipelineSchema>;
export type UpdatePipelineCandidateInput = z.infer<typeof updatePipelineCandidateSchema>;
