export const normalizeSearchText = (value: string): string => value
  .normalize('NFKC')
  .toLowerCase();

// Insertions, deletions, substitutions and adjacent letter swaps cost one.
const spellingDistance = (query: string, word: string): number => {
  let previous = Array.from({ length: word.length + 1 }, (_, index) => index);
  let beforePrevious = previous;
  for (let row = 1; row <= query.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= word.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (query[row - 1] === word[column - 1] ? 0 : 1),
      );
      if (row > 1 && column > 1
        && query[row - 1] === word[column - 2] && query[row - 2] === word[column - 1]) {
        current[column] = Math.min(current[column], beforePrevious[column - 2] + 1);
      }
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[word.length];
};

export const fuzzySearchScore = (query: string, fields: string[]): number => {
  // Keep short words and non-English queries strict; avoid loose substring fuzzing.
  if (!/^[a-z]+(?:[\s-]+[a-z]+)*$/.test(query)) return 0;
  const terms = query.split(/[\s-]+/);
  if (terms.length > 8 || terms.every((term) => term.length < 4)
    || terms.some((term) => term.length > 48)) return 0;
  const words = new Map<string, number>();
  fields.forEach((field, index) => {
    for (const word of field.match(/[a-z]+/g) ?? []) {
      words.set(word, Math.max(words.get(word) ?? 0, index === 0 ? 3 : 1));
    }
  });
  let score = 0;
  for (const term of terms) {
    const limit = term.length < 4 ? 0 : term.length < 8 ? 1 : 2;
    let best = 0;
    for (const [word, weight] of words) {
      if (Math.abs(term.length - word.length) > limit) continue;
      const distance = spellingDistance(term, word);
      if (distance <= limit) best = Math.max(best, weight + 1 - distance / (limit + 1));
    }
    if (!best) return 0;
    score += best;
  }
  return score / terms.length;
};
