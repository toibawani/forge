/**
 * Mentor feedback, derived deterministically from the answer.
 *
 * This is not a language model guessing at quality: every line is traceable to
 * a measurement (word count, paragraph count, numeric evidence, hedging). That
 * matters because the feedback sits next to a score people may be judged on —
 * vague praise would be worse than no feedback at all.
 *
 * Pure functions, no I/O: the API writes the result alongside the attempt and
 * the result page can recompute it for older attempts.
 */

export type FeedbackDimension = "completeness" | "structure" | "specificity";

export type FeedbackMetrics = {
  words: number;
  sentences: number;
  paragraphs: number;
  avgSentenceWords: number;
  numbers: number;
  codeSpans: number;
  identifiers: number;
  hedges: number;
  vagueQuantifiers: number;
  hasList: boolean;
};

export type FeedbackItem = {
  title: string;
  detail: string;
  /** A concrete rewrite prompt, not a rule restatement. */
  example?: string;
};

export type DimensionVerdict = {
  key: FeedbackDimension;
  label: string;
  score: number;
  verdict: string;
  verdictTone: "strong" | "solid" | "weak";
};

export type AttemptFeedback = {
  version: "mentor-v1";
  headline: string;
  strengths: FeedbackItem[];
  improvements: FeedbackItem[];
  focus: string;
  dimensions: DimensionVerdict[];
  metrics: FeedbackMetrics;
};

const HEDGES = /\b(maybe|perhaps|i think|i guess|probably|possibly|kind of|sort of|somewhat|hopefully|i believe|it seems)\b/gi;
const VAGUE = /\b(some|many|a lot|a few|several|stuff|things|something|various|etc\.?|and so on|stuff like that)\b/gi;

export function measureAnswer(answer: string): FeedbackMetrics {
  const text = answer.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim().length > 0);
  const paragraphs = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);

  return {
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgSentenceWords: sentences.length ? Math.round((words.length / sentences.length) * 10) / 10 : words.length,
    numbers: (text.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []).length,
    codeSpans: (text.match(/`[^`]+`/g) ?? []).length,
    identifiers:
      (text.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? []).length +
      (text.match(/\b[A-Za-z]+[A-Z][A-Za-z0-9]*\b/g) ?? []).length,
    hedges: (text.match(HEDGES) ?? []).length,
    vagueQuantifiers: (text.match(VAGUE) ?? []).length,
    hasList: /(^|\n)\s*(?:[-*]|\d+\.)\s/.test(text),
  };
}

function verdictFor(key: FeedbackDimension, score: number): DimensionVerdict {
  const label = key === "completeness" ? "Completeness" : key === "structure" ? "Structure" : "Specificity";

  if (key === "completeness") {
    if (score >= 85) return { key, label, score, verdict: "Covers everything the brief asked for", verdictTone: "strong" };
    if (score >= 60) return { key, label, score, verdict: "Mostly there — one part of the brief is thin", verdictTone: "solid" };
    return { key, label, score, verdict: "Well short of what the brief asked for", verdictTone: "weak" };
  }

  if (key === "structure") {
    if (score >= 80) return { key, label, score, verdict: "Easy to scan: a reader can find the answer fast", verdictTone: "strong" };
    if (score >= 60) return { key, label, score, verdict: "Readable, but the reasoning and conclusion blur together", verdictTone: "solid" };
    return { key, label, score, verdict: "One block of text — the reader has to work to follow it", verdictTone: "weak" };
  }

  if (score >= 80) return { key, label, score, verdict: "Concrete: names, numbers and code a reviewer can check", verdictTone: "strong" };
  if (score >= 60) return { key, label, score, verdict: "Some specifics, still leaning on adjectives", verdictTone: "solid" };
  return { key, label, score, verdict: "Abstract — a confident answer could say the same thing", verdictTone: "weak" };
}

export function buildFeedback(input: {
  answer: string;
  signals: { completeness: number; structure: number; specificity: number };
  minWords: number;
  category: string;
}): AttemptFeedback {
  const metrics = measureAnswer(input.answer);
  const dimensions: DimensionVerdict[] = [
    verdictFor("completeness", input.signals.completeness),
    verdictFor("structure", input.signals.structure),
    verdictFor("specificity", input.signals.specificity),
  ];

  const ranked = [...dimensions].sort((a, b) => b.score - a.score);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  const strengths: FeedbackItem[] = [];

  if (strongest.verdictTone !== "weak") {
    strengths.push({
      title: strongest.label,
      detail: strongest.verdict,
    });
  }

  if (metrics.numbers >= 2 || metrics.codeSpans >= 1) {
    strengths.push({
      title: "Evidence, not adjectives",
      detail: `You used ${metrics.numbers} concrete ${metrics.numbers === 1 ? "figure" : "figures"}${
        metrics.codeSpans ? ` and ${metrics.codeSpans} code ${metrics.codeSpans === 1 ? "span" : "spans"}` : ""
      }. That is what makes an answer checkable rather than merely confident.`,
    });
  }

  if (metrics.hasList || metrics.paragraphs >= 2) {
    strengths.push({
      title: "Structured for a reader",
      detail: metrics.hasList
        ? "The list structure lets a reviewer find each point without re-reading."
        : `${metrics.paragraphs} paragraphs separate reasoning from conclusion — a reviewer can skim it.`,
    });
  }

  if (metrics.hedges === 0 && metrics.words >= input.minWords) {
    strengths.push({
      title: "Committed claims",
      detail: "No hedging language: you stated a position instead of describing one.",
    });
  }

  const improvements: FeedbackItem[] = [];

  if (weakest.verdictTone !== "strong") {
    if (weakest.key === "completeness") {
      improvements.push({
        title: "Answer every part of the brief",
        detail: `You wrote ${metrics.words} words against a target of about ${input.minWords}, and part of the brief is unaddressed. Completeness is scored on coverage, not length.`,
        example:
          "Re-read the brief and tick off each requirement before you start writing; the missing part is usually the 'why'.",
      });
    } else if (weakest.key === "structure") {
      improvements.push({
        title: "Separate the finding from the reasoning",
        detail:
          metrics.avgSentenceWords > 30
            ? `Your sentences average ${metrics.avgSentenceWords} words, so the finding is buried. Open with the answer, then justify it.`
            : "The answer arrives as a single block, so the conclusion has to be dug out of it.",
        example: "Open with one sentence that states the answer. Then two short paragraphs: cause, then fix.",
      });
    } else {
      improvements.push({
        title: "Replace generalities with evidence",
        detail:
          metrics.numbers === 0
            ? "There is not a single number, identifier or code reference in the answer, so a reviewer cannot verify the claim."
            : `Only ${metrics.numbers} concrete detail${metrics.numbers === 1 ? " appears" : "s appear"} in ${metrics.words} words.`,
        example: "Name the file, function, metric or figure. \"It is slow\" becomes \"p95 is 2.4s against a 500ms budget\".",
      });
    }
  }

  if (metrics.vagueQuantifiers >= 2) {
    improvements.push({
      title: "Quantify the vague terms",
      detail: `Phrases like "some", "many" or "a lot" appear ${metrics.vagueQuantifiers} times. Each one is a question the reviewer has to ask.`,
      example: "Swap each vague quantity for a number, or delete the sentence.",
    });
  }

  if (metrics.hedges >= 2) {
    improvements.push({
      title: "Cut the hedging",
      detail: `Hedging language appears ${metrics.hedges} times ("probably", "I think", "maybe"). In a technical answer it reads as uncertainty about your own work.`,
      example: "State the claim. If you are genuinely unsure, say what would settle it.",
    });
  }

  const focusByDimension: Record<FeedbackDimension, string> = {
    completeness:
      "Next attempt: outline the brief's requirements first, then answer each one in a sentence. Coverage beats prose.",
    structure:
      "Next attempt: lead with the answer in one sentence, then two short paragraphs — cause, then fix.",
    specificity:
      "Next attempt: every claim gets a number, an identifier, or a named example. No claim stays abstract.",
  };

  const headline =
    weakest.verdictTone === "strong"
      ? `Strong answer on all three dimensions — ${strongest.verdict.toLowerCase()}.`
      : `${strongest.label} is your strength here; ${weakest.label.toLowerCase()} is what holds the score back.`;

  return {
    version: "mentor-v1",
    headline,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    focus: focusByDimension[weakest.key],
    dimensions,
    metrics,
  };
}
