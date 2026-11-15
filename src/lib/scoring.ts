/**
 * Rubric v1 — deterministic, explainable scoring.
 *
 * Forge does not use a hidden model to grade people: a score has to be
 * defensible to the person who earned it and to the recruiter reading it.
 * This rubric rewards substance (covering the question), structure (readable,
 * organised) and specificity (concrete identifiers, numbers, code), and it
 * never rewards length alone past the challenge minimum.
 */

export type Rubric = {
  min_words?: number;
  signals?: string[];
};

export type ScoreBreakdown = {
  version: "rubric-v1";
  score: number;
  signals: {
    completeness: number;
    structure: number;
    specificity: number;
  };
  notes: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function scoreSubmission(
  answer: string,
  rubric: Rubric | null,
  category: string
): ScoreBreakdown {
  const text = answer.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const minWords = rubric?.min_words ?? 25;
  const notes: string[] = [];

  // Completeness: does the answer actually engage with the task?
  const coverage = clamp(Math.round((wordCount / minWords) * 100));
  if (coverage < 60) notes.push("Answer is shorter than the challenge asks for.");

  // Structure: paragraphs, list markers or code fences.
  const paragraphs = text.split(/\n{2,}/).filter((block) => block.trim().length > 0).length;
  const hasStructure =
    paragraphs >= 2 || /(^|\n)\s*([-*]|\d+\.)\s/.test(text) || /```/.test(text);
  const structure = clamp((hasStructure ? 70 : 35) + Math.min(paragraphs, 4) * 8);
  if (!hasStructure) notes.push("No structure detected — separate reasoning from conclusion.");

  // Specificity: identifiers, numbers, units, code.
  const codeTokens = (text.match(/`[^`]+`/g) ?? []).length;
  const numbers = (text.match(/\b\d+(\.\d+)?%?\b/g) ?? []).length;
  const identifiers = (text.match(/\b[A-Za-z]+[A-Z][A-Za-z0-9]*\b/g) ?? []).length;
  const specificity = clamp(30 + codeTokens * 12 + Math.min(numbers, 5) * 8 + Math.min(identifiers, 4) * 8);

  const engineeringBias = category === "engineering" ? 0.95 : 1;
  const raw =
    coverage * 0.4 + structure * 0.25 + specificity * 0.35;
  const score = clamp(Math.round(raw * engineeringBias));

  return {
    version: "rubric-v1",
    score,
    signals: {
      completeness: coverage,
      structure,
      specificity,
    },
    notes,
  };
}
