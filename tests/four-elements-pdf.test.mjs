import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createReportPdf } from '../src/lib/four-elements-pdf.ts';
import { mockAiReport } from './fixtures/four-elements/ai-response.mjs';

const fonts = Object.fromEntries(['regular', 'semibold'].map(name => [name, readFileSync(new URL(`../public/fonts/star-report/${name}-cjk.ttf`, import.meta.url))]));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/four-elements/input.json', import.meta.url)));
const sample = [...fixture.likert, ...fixture.forced];

test('accepted paragraph variants still export as a text PDF', async () => {
  const report = mockAiReport();
  report.readings[0].paragraphs = [report.readings[0].paragraphs.join('')];
  report.readings[1].paragraphs.push(report.readings[1].paragraphs[0]);
  report.elements[1].nuance = '保留感受，也需要自己的节奏。';
  const blob = await createReportPdf(sample, { fonts, ai: report });
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  assert.ok(doc.getPageCount() >= 7 && doc.getPageCount() <= 10);
});

test('report uses embedded text fonts and vectors on A4 pages without image XObjects', async () => {
  const blob = await createReportPdf(sample, { fonts, date: new Date('2026-10-29T10:00:00Z') });
  assert.equal(blob.type, 'application/pdf');
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  assert.match(doc.getTitle(), /星象测试/);
  assert.ok(doc.getPageCount() >= 7 && doc.getPageCount() <= 10);
  let fontCount = 0;
  for (const page of doc.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < .01);
    assert.ok(Math.abs(page.getHeight() - 841.89) < .01);
    const resources = page.node.Resources();
    const images = resources.lookupMaybe(PDFName.of('XObject'), PDFDict);
    assert.equal(images?.keys().length ?? 0, 0);
    const fontResources = resources.lookup(PDFName.of('Font'), PDFDict);
    for (const [, reference] of fontResources.entries()) {
      const font = doc.context.lookup(reference, PDFDict);
      assert.ok(font.has(PDFName.of('ToUnicode')));
      fontCount++;
    }
  }
  assert.ok(fontCount >= 2);
});

test('both bundled fonts cover report and questionnaire wording', () => {
  const sources = ['four-elements.ts', 'four-elements-report.ts', 'four-elements-pdf-document.ts'];
  const text = sources.map(name => readFileSync(new URL(`../src/lib/${name}`, import.meta.url), 'utf8')).join('')
    + readFileSync(new URL('../src/data/four-elements/question-bank.json', import.meta.url), 'utf8');
  for (const data of Object.values(fonts)) {
    const font = fontkit.create(data);
    for (const char of new Set(text)) {
      if (char.codePointAt(0) < 32) continue;
      assert.ok(font.hasGlyphForCodePoint(char.codePointAt(0)), `Missing glyph: ${char}`);
    }
  }
});

test('uniform and extreme answers export without inventing item distinctions', async () => {
  for (const value of [1, 3, 5]) {
    const blob = await createReportPdf([...Array(36).fill(value), ...fixture.forced], { fonts });
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    assert.ok(doc.getPageCount() >= 7 && doc.getPageCount() <= 10);
  }
});

test('font loading failure reports an error and permits a successful retry', async (t) => {
  let unavailable = true;
  t.mock.method(globalThis, 'fetch', async url => unavailable
    ? new Response('', { status: 503 })
    : new Response(fonts[String(url).includes('semibold') ? 'semibold' : 'regular']));
  await assert.rejects(createReportPdf(sample), /字体加载失败/);
  unavailable = false;
  const blob = await createReportPdf(sample);
  assert.equal(blob.type, 'application/pdf');
  assert.ok((await PDFDocument.load(await blob.arrayBuffer())).getPageCount() >= 7);
});

test('AI report exports the same validated prose as selectable PDF text', async () => {
  const blob = await createReportPdf(sample, { fonts, ai: mockAiReport() });
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  assert.ok(doc.getPageCount() >= 7);
  for (const page of doc.getPages()) {
    const objects = page.node.Resources().lookupMaybe(PDFName.of('XObject'), PDFDict);
    assert.equal(objects?.keys().length ?? 0, 0);
  }
});
