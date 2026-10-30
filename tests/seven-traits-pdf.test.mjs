import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { createReportPdf } from '../src/lib/seven-traits-pdf.ts';
import { mockAiReport } from './fixtures/seven-traits/ai-response.mjs';
const fonts = Object.fromEntries(['regular', 'semibold'].map(n => [n, readFileSync(new URL(`../public/fonts/star-report/${n}-cjk.ttf`, import.meta.url))]));
const logo = readFileSync(new URL('../public/images/seven-traits-emblem-v2.png', import.meta.url));
test('seven-traits exports A4 selectable text, embedded CJK fonts and vector radar', async () => {
  const blob = await createReportPdf(Array(56).fill(3), mockAiReport(), { fonts, logo, date: new Date('2026-10-29T12:00:00Z') });
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/pdf'); assert.match(doc.getTitle(), /七宗罪/);
  assert.ok(doc.getPageCount() >= 8 && doc.getPageCount() < 20);
  for (const [index, page] of doc.getPages().entries()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < .01 && Math.abs(page.getHeight() - 841.89) < .01);
    const resources = page.node.Resources();
    assert.equal(resources.lookupMaybe(PDFName.of('XObject'), PDFDict)?.keys().length ?? 0, index === 0 ? 1 : 0);
    for (const [, ref] of resources.lookup(PDFName.of('Font'), PDFDict).entries()) assert.ok(doc.context.lookup(ref, PDFDict).has(PDFName.of('ToUnicode')));
  }
});
test('PDF rejects invalid answers, invalid report and unsupported CJK glyphs explicitly', async () => {
  await assert.rejects(createReportPdf(Array(55).fill(3), mockAiReport(), { fonts }));
  const invalid = mockAiReport(); invalid.pairs.pop();
  await assert.rejects(createReportPdf(Array(56).fill(3), invalid, { fonts }));
  const unsupported = mockAiReport(); unsupported.overview.summary += '𠮷';
  await assert.rejects(createReportPdf(Array(56).fill(3), unsupported, { fonts }), /字体/);
});
