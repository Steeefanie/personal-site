/** Optional editorial emphasis, shared by report validation, HTML and PDF. */
export const emphasisLimits = { minLength: 4, maxLength: 36, maxRatio: .5 };
export type EmphasisRange = { start: number; end: number };
/** Positions refer to the original paragraph, before indentation or PDF wrapping. */
export type ResolvedEmphasis = ReadonlyMap<string, readonly EmphasisRange[]>;
export type ReportEmphasis = readonly string[] | ResolvedEmphasis;
export function literalEmphasis(value: unknown, body: string | string[]): string[] {
  if (!Array.isArray(value)) return [];
  const paragraphs = Array.isArray(body) ? body : [body];
  const candidates = [...new Set(value.filter((v): v is string => typeof v === 'string'))];
  const selected: string[] = [];
  for (const paragraph of paragraphs) {
    const phrase = candidates.find(candidate => {
      const length = [...candidate].length;
      if (length < emphasisLimits.minLength || length > emphasisLimits.maxLength
        || length > [...paragraph.trim()].length * emphasisLimits.maxRatio || !paragraph.includes(candidate)) return false;
      // Repeated labels do not carry a unique emphasis position. Keep ordinary
      // text rather than highlighting every occurrence or guessing its meaning.
      return paragraphs.reduce((count, text) => count + text.split(candidate).length - 1, 0) === 1;
    });
    if (phrase) selected.push(phrase);
  }
  return selected;
}

export function resolveEmphasis(value: unknown, body: string | string[], structuralText: string[] = []): ResolvedEmphasis {
  const paragraphs = Array.isArray(body) ? body : [body];
  const candidates = Array.isArray(value) ? value.filter(v => typeof v === 'string' && !structuralText.some(text => text.includes(v))) : [];
  const phrases = literalEmphasis(candidates, paragraphs);
  return new Map(paragraphs.map(text => {
    const phrase = phrases.find(p => text.includes(p));
    const start = phrase ? text.indexOf(phrase) : -1;
    return [text, start < 0 ? [] : [{ start, end: start + phrase!.length }]];
  }));
}

export function paragraphEmphasis(text: string, emphasis: ReportEmphasis = []): readonly EmphasisRange[] {
  return (Array.isArray(emphasis) ? resolveEmphasis(emphasis, text) : emphasis as ResolvedEmphasis).get(text) ?? [];
}

export function emphasisRuns(text: string, emphasis: ReportEmphasis = [], range = { start: 0, end: text.length }) {
  const marked = new Uint8Array(text.length);
  for (const selected of paragraphEmphasis(text, emphasis)) marked.fill(1, selected.start, selected.end);
  const runs: { text: string; bold: boolean }[] = [];
  for (let i = range.start; i < range.end;) {
    const char = String.fromCodePoint(text.codePointAt(i)!); const bold = marked[i] === 1;
    const previous = runs.at(-1);
    if (previous && previous.bold === bold) previous.text += char;
    else runs.push({ text: char, bold });
    i += char.length;
  }
  return runs;
}
