/**
 * Command palette matching.
 *
 * Kept pure and separate from the component so the behaviour that matters can be
 * asserted: an empty query shows navigation only, a real query searches the
 * challenge catalogue too, and the list stays short enough to stay usable.
 */

export type PaletteItem = {
  href: string;
  label: string;
  hint: string;
};

export type PaletteChallenge = {
  slug: string;
  title: string;
  category: string;
  difficulty: string;
};

const MAX_CHALLENGES = 6;

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

export function buildPaletteResults(
  items: PaletteItem[],
  challenges: PaletteChallenge[],
  query: string
): PaletteItem[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    // No catalogue dump on an empty palette: the point is to jump somewhere you
    // already had in mind, not to browse forty challenges by keyboard.
    return items;
  }

  const navigation = items.filter(
    (item) => matches(item.label, needle) || matches(item.hint, needle)
  );

  const practice = challenges
    .filter(
      (challenge) =>
        matches(challenge.title, needle) ||
        matches(challenge.category, needle) ||
        matches(challenge.slug, needle) ||
        matches(challenge.difficulty, needle)
    )
    .slice(0, MAX_CHALLENGES)
    .map((challenge) => ({
      href: `/practice/${challenge.slug}`,
      label: challenge.title,
      hint: `${challenge.category} · ${challenge.difficulty}`,
    }));

  const seen = new Set<string>();
  return [...navigation, ...practice].filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
