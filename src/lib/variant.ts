/**
 * Picking a variant after a weak attempt.
 *
 * A retry is only worth anything if it is a different prompt against the same
 * skill: repeating the question you just read measures memory, not ability.
 * Deterministic so the link is stable across reloads, and it never suggests a
 * challenge the person has already answered.
 */

export type VariantCandidate = {
  slug: string;
  track: string;
  subSkills: string[];
  difficultyRating?: number;
};

export type VariantPick = {
  slug: string;
  reason: string;
};

export function variantPick(input: {
  challenges: VariantCandidate[];
  currentSlug: string;
  attemptedSlugs: string[];
  subSkills?: string[];
}): VariantPick | null {
  const current = input.challenges.find((challenge) => challenge.slug === input.currentSlug);
  if (!current) return null;

  const attempted = new Set(input.attemptedSlugs);
  const wanted = new Set(
    (input.subSkills && input.subSkills.length > 0 ? input.subSkills : current.subSkills).filter(Boolean)
  );

  const eligible = input.challenges.filter(
    (challenge) =>
      challenge.slug !== current.slug &&
      challenge.track === current.track &&
      !attempted.has(challenge.slug)
  );

  if (eligible.length === 0) return null;

  const scored = eligible.map((challenge) => {
    const shared = challenge.subSkills.filter((skill) => wanted.has(skill));
    const distance =
      typeof challenge.difficultyRating === "number" && typeof current.difficultyRating === "number"
        ? Math.abs(challenge.difficultyRating - current.difficultyRating)
        : 0;
    return { challenge, shared, distance };
  });

  scored.sort((left, right) => {
    if (right.shared.length !== left.shared.length) return right.shared.length - left.shared.length;
    if (left.distance !== right.distance) return left.distance - right.distance;
    return left.challenge.slug.localeCompare(right.challenge.slug);
  });

  const winner = scored[0];
  const shared = winner.shared;

  return {
    slug: winner.challenge.slug,
    reason:
      shared.length > 0
        ? `Same skill, different prompt: another ${shared.join(" and ")} question you have not answered.`
        : "Same track, different prompt: a second read on the skill without repeating the question.",
  };
}
