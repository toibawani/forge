import { z } from "zod";

/** Model output is untrusted: it is validated before it becomes a grade. */
export const graderOutputSchema = z.object({
  dimensions: z
    .array(
      z.object({
        id: z.string().trim().min(2).max(40),
        score: z.number().int().min(0).max(4),
        evidence: z.string().trim().min(3).max(500),
      })
    )
    .min(3)
    .max(5),
});

export type GraderOutput = z.infer<typeof graderOutputSchema>;

/**
 * Pulls JSON out of a model response that may be fenced or prefixed. Returns
 * null rather than throwing, so the caller decides whether to retry.
 */
export function parseGraderOutput(raw: string): GraderOutput | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    const validated = graderOutputSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}
