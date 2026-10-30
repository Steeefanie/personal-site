import { beginText, endText, setCharacterSpacing, setFontAndSize, setFillingColor, setTextMatrix, showText, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { wrapPdfText } from './report-pdf-text.ts';
import { emphasisRuns, paragraphEmphasis, type ReportEmphasis, type ResolvedEmphasis } from './report-emphasis.ts';

export type PdfTextRow = { runs: { text: string; bold: boolean }[]; spacing: number };
export function layoutPdfRichText(text: string, width: number, size: number, regular: PDFFont, semibold: PDFFont, emphasis: ReportEmphasis = [], indent = false) {
  const prefix = indent ? '　　' : '', source = prefix + text;
  const positions: ResolvedEmphasis = new Map([[source, paragraphEmphasis(text, emphasis).map(r => ({ start: r.start + prefix.length, end: r.end + prefix.length }))]]);
  const lines = wrapPdfText(source, width, size, regular);
  let offset = 0;
  const rows = lines.map((row, index) => {
    const start = source.indexOf(row, offset);
    const runs = emphasisRuns(source, positions, { start, end: start + row.length });
    offset = start + row.length;
    const rowWidth = runs.reduce((sum, run) => sum + (run.bold ? semibold : regular).widthOfTextAtSize(run.text, size), 0);
    return { runs, spacing: index < lines.length - 1 && row.length > 1 ? Math.max(0, (width - rowWidth) / (row.length - 1)) : 0 };
  });
  return { rows, leading: size * 1.8, height: rows.length * size * 1.8 };
}
export function drawPdfTextRows(page: PDFPage, rows: PdfTextRow[], x: number, top: number, size: number, color: RGB, regular: PDFFont, semibold: PDFFont, pageHeight: number) {
  rows.forEach((row, index) => {
    let left = x;
    row.runs.forEach(run => {
      const font = run.bold ? semibold : regular, key = page.node.newFontDictionary(font.name, font.ref);
      page.pushOperators(beginText(), setFontAndSize(key, size), setFillingColor(color), setTextMatrix(1, 0, 0, 1, left, pageHeight - top - index * size * 1.8 - size), setCharacterSpacing(row.spacing), showText(font.encodeText(run.text)), setCharacterSpacing(0), endText());
      left += font.widthOfTextAtSize(run.text, size) + run.text.length * row.spacing;
    });
  });
  return rows.length * size * 1.8;
}
export function pdfNeedsPage(top: number, height: number, bottom: number) { return top + height > bottom; }
export function pdfCardHeight(card: { title: string; body: string[] }, width: number, size: number, regular: PDFFont, semibold: PDFFont, labelHeight = 22) {
  return 30 + labelHeight + wrapPdfText(card.title, width - 30, 13, semibold).length * 19 + 12
    + card.body.reduce((sum, text) => sum + layoutPdfRichText(text, width - 30, size, regular, semibold).height + 10, 0);
}
