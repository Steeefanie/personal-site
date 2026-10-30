import type { PDFFont } from 'pdf-lib';
export function wrapPdfText(text: string, width: number, size: number, font: PDFFont) {
  const lines: string[] = []; let current = '';
  for (const char of text) {
    if (char === '\n') { lines.push(current); current = ''; continue; }
    if (!current || font.widthOfTextAtSize(current + char, size) <= width) { current += char; continue; }
    let carry = '';
    if (/[，。；：！？、）”》】]/u.test(char) || /[（“《【]$/u.test(current)) { carry = current.slice(-1); current = current.slice(0, -1); }
    if (current) lines.push(current);
    current = carry + char;
  }
  if (current) lines.push(current);
  return lines;
}
