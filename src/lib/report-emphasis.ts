/** Literal highlights only; no model-generated markup is interpreted. */
export function emphasisRuns(text: string, emphasis: string[] = [], range = { start: 0, end: text.length }) {
  const marked = new Uint8Array(text.length);
  for (const phrase of emphasis) {
    if (!phrase) continue;
    let at = text.indexOf(phrase);
    while (at >= 0) { marked.fill(1, at, at + phrase.length); at = text.indexOf(phrase, at + phrase.length); }
  }
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
