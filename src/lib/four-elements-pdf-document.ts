import { PDFDocument, PDFFont, PDFPage, PDFName, PDFString, rgb, beginText, endText, setCharacterSpacing, setFontAndSize, setFillingColor, setTextMatrix, showText, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { elementInfo, scoreAnswers, type Answers, type Element } from './four-elements.ts';
import { buildNarrativeReport } from './four-elements-report.ts';
import { reportMethod, readingNote } from './four-elements-reading.ts';
import { elementIconPaths } from './element-icons.ts';
import { wrapPdfText } from './report-pdf-text.ts';
import { emphasisRuns } from './report-emphasis.ts';
import type { AiReport, ReportCard } from './four-elements-ai.ts';

import { loadReportFonts, type ReportFonts } from './report-fonts.ts';
export type { ReportFonts } from './report-fonts.ts';
type Options = { fonts?: ReportFonts; date?: Date; ai?: AiReport };
const hex = (value: string) => rgb(...[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number]);
const ink = hex('#25272d'), muted = hex('#777d86'), rule = hex('#dfe2e8'), pale = hex('#f6f7f9');
const colors: Record<Element, RGB> = { water: hex('#128eae'), fire: hex('#e56742'), earth: hex('#b98718'), wind: hex('#7c65d9') };
const W = 595.28, H = 841.89, M = 50, CW = W - 2 * M, BOTTOM = 775;

/** Actual PDF text with embedded CJK fonts and vector icons; no page screenshots. */
export async function createReportPdf(answers: Answers, options: Options = {}): Promise<Blob> {
  const result = scoreAnswers(answers), model = buildNarrativeReport(result, options.ai);
  const fonts = options.fonts ?? await loadReportFonts();
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  // Assets are already subsetted at build time. Re-subsetting the CJK semibold font
  // can discard outlines in fontkit; embed these small static assets intact.
  const [regular, semibold] = await Promise.all([doc.embedFont(fonts.regular), doc.embedFont(fonts.semibold)]);
  if (options.ai) {
    const supported = new Set(regular.getCharacterSet());
    const strings: string[] = [];
    const collect = (value: unknown) => {
      if (typeof value === 'string') strings.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(options.ai);
    if (strings.some(text => [...text].some(char => char !== '\n' && !supported.has(char.codePointAt(0)!)))) {
      throw new Error('AI 解读含字体暂不支持的字符，请重新生成解读后保存。');
    }
  }
  doc.setTitle('星象测试 · 个人倾向报告'); doc.setAuthor('Steeefanie');
  doc.setCreator('Steeefanie / Star Elements Report');
  doc.catalog.set(PDFName.of('Lang'), PDFString.of('zh-CN'));
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(options.date ?? new Date());
  let page: PDFPage, y = 0, chapter = '';
  const at = (text: string, x: number, top: number, size = 10, color = ink, bold = false) => page.drawText(text, { x, y: H - top - size, size, font: bold ? semibold : regular, color });
  const right = (text: string, end: number, top: number, size = 10, color = ink, bold = false) => at(text, end - (bold ? semibold : regular).widthOfTextAtSize(text, size), top, size, color, bold);
  const line = (top: number, x = M, width = CW) => page.drawLine({ start: { x, y: H - top }, end: { x: x + width, y: H - top }, thickness: .6, color: rule });
  const rect = (x: number, top: number, width: number, height: number, color: RGB) => page.drawRectangle({ x, y: H - top - height, width, height, color });
  const wrap = (text: string, width: number, size: number, font: PDFFont = regular) => wrapPdfText(text, width, size, font);
  function newPage(label: string) {
    chapter = label; page = doc.addPage([W, H]);
    at('Steeefanie  /  星象测试', M, 32, 7.5, muted);
    right(label, W - M, 32, 7.5, muted); line(53); y = 82;
  }
  function ensure(height: number) { if (y + height > BOTTOM) newPage(chapter); }
  function richHeight(text: string, width: number, size: number, indent = false) {
    return wrap(`${indent ? '　　' : ''}${text}`, width, size).length * size * 1.8;
  }
  function richText(text: string, x: number, top: number, width: number, size: number, emphasis: string[] = [], indent = false, color = ink) {
    const source = `${indent ? '　　' : ''}${text}`;
    const rows = wrap(source, width, size), leading = size * 1.8;
    let offset = 0;
    rows.forEach((row, i) => {
      const start = source.indexOf(row, offset);
      const runs = emphasisRuns(source, emphasis, { start, end: start + row.length });
      offset = start + row.length;
      const rowWidth = runs.reduce((sum, run) => sum + (run.bold ? semibold : regular).widthOfTextAtSize(run.text, size), 0);
      const spacing = i < rows.length - 1 && row.length > 1 ? Math.max(0, (width - rowWidth) / (row.length - 1)) : 0;
      let left = x;
      for (const run of runs) {
        const font = run.bold ? semibold : regular, key = page.node.newFontDictionary(font.name, font.ref);
        page.pushOperators(beginText(), setFontAndSize(key, size), setFillingColor(color),
          setTextMatrix(1, 0, 0, 1, left, H - top - i * leading - size), setCharacterSpacing(spacing),
          showText(font.encodeText(run.text)), setCharacterSpacing(0), endText());
        left += font.widthOfTextAtSize(run.text, size) + run.text.length * spacing;
      }
    });
    return rows.length * leading;
  }
  function paragraph(text: string, size = 11.2, color = ink, indent = true, emphasis: string[] = []) {
    ensure(richHeight(text, CW, size, indent) + 12);
    y += richText(text, M, y, CW, size, emphasis, indent, color) + 12;
  }
  function rounded(x: number, top: number, width: number, height: number, fill = pale, border?: RGB) {
    const r = 10;
    page.drawSvgPath(`M${r} 0 H${width-r} Q${width} 0 ${width} ${r} V${height-r} Q${width} ${height} ${width-r} ${height} H${r} Q0 ${height} 0 ${height-r} V${r} Q0 0 ${r} 0 Z`, {
      x, y: H - top, color: fill, ...(border ? { borderColor: border, borderWidth: .6 } : {}),
    });
  }
  function cardHeight(card: ReportCard, width: number, size: number) {
    return 30 + (card.element ? 35 : 22) + wrap(card.title, width - 30, 13, semibold).length * 19 + 12
      + card.body.reduce((sum, text) => sum + richHeight(text, width - 30, size) + 10, 0);
  }
  function drawCard(card: ReportCard, x: number, top: number, width: number, height: number, index: number, size: number, accent?: RGB) {
    const color = card.element ? colors[card.element] : accent || muted;
    rounded(x, top, width, height);
    let cy = top + 15;
    if (card.element) { icon(card.element, x + 15, cy, 22); at(elementInfo[card.element].name, x + 46, cy + 3, 11, color, true); cy += 35; }
    else { at(String(index + 1).padStart(2, '0'), x + 15, cy, 8, color, true); cy += 22; }
    for (const row of wrap(card.title, width - 30, 13, semibold)) { at(row, x + 15, cy, 13, ink, true); cy += 19; }
    cy += 12;
    card.body.forEach((text, i) => {
      if (i) { line(cy - 5, x + 15, width - 30); }
      cy += richText(text, x + 15, cy, width - 30, size, card.emphasis) + 10;
    });
    return cy;
  }
  function cards(items: ReportCard[], columns = 2, accent?: RGB, size = columns === 3 ? 10 : 10.4) {
    if (!items.length) return;
    const gap = 14, width = (CW - gap * (columns - 1)) / columns;
    for (let i = 0; i < items.length; i += columns) {
      const row = items.slice(i, i + columns), height = Math.max(...row.map(item => cardHeight(item, width, size)));
      ensure(height + 14);
      row.forEach((item, index) => drawCard(item, M + index * (width + gap), y, width, height, i + index, size, accent));
      y += height + 14;
    }
  }
  function section(text: string, color = ink) { ensure(140); y += 12; at(text, M, y, 13, color, true); y += 30; }
  function icon(element: Element, x: number, top: number, size: number) {
    const ratio = element === 'water' ? 1.066667 : 1;
    elementIconPaths[element].forEach(path => page.drawSvgPath(path, {
      x: x + 12 * (1 - ratio) * size / 24, y: H - top - 2.5 * (1 - ratio) * size / 24,
      scale: size / 24 * ratio, borderColor: colors[element], borderWidth: 1.6, borderLineCap: 1,
    }));
  }
  function title(text: string, subtitle = '', members: Element[] = []) {
    if (members.length) {
      members.forEach((element, i) => icon(element, M + i * 42, y, 28)); y += 48;
    }
    const rows = wrap(text, CW, 23, semibold);
    rows.forEach(row => { at(row, M, y, 23, ink, true); y += 34; });
    if (subtitle) { y += 8; paragraph(subtitle, 9, muted, false); }
    y += 18;
  }
  function quote(text: string, color = ink) {
    const rows = wrap(text, CW - 36, 12, semibold), height = rows.length * 21 + 28;
    ensure(height + 16); rect(M, y, CW, height, pale); rect(M, y, 2, height, color);
    rows.forEach((row,i) => at(row, M + 18, y + 14 + i * 21, 12, ink, true)); y += height + 18;
  }

  newPage('个人倾向报告');
  y = 174;
  result.ranking.forEach((element, i) => icon(element, M + i * 50, y, 32));
  y = 244; at('星象测试', M, y, 36, ink, true); y += 60;
  at('个人倾向报告', M, y, 18, muted); y += 64;
  for (const row of wrap(model.headline, CW, 19, semibold)) { at(row, M, y, 19, colors[result.ranking[0]], true); y += 31; }
  y = Math.max(470, y + 38);
  quote(model.coreSentence || model.conclusion, colors[result.ranking[0]]);
  y = 704; at(date, M, y, 10, muted); y += 24;
  paragraph('基于本次完整作答 · 仅供娱乐与自我探索', 9, muted, false);

  newPage('结果总览');
  title('结果总览', '四种倾向，可以同时存在');
  const panelsTop = y, panelHeight = 420, chartWidth = 282, rightX = M + chartWidth + 16, textWidth = CW - chartWidth - 16;
  rounded(M, panelsTop, chartWidth, panelHeight);
  at('四元素倾向', M + 18, panelsTop + 18, 12, ink, true);
  let chartY = panelsTop + 56;
  result.ranking.forEach(element => {
    icon(element, M + 18, chartY + 3, 22); at(elementInfo[element].name, M + 52, chartY + 2, 12, colors[element], true);
    right(result.composite[element].toFixed(1), M + chartWidth - 18, chartY + 2, 15, colors[element], true);
    at(elementInfo[element].meaning, M + 52, chartY + 25, 8, muted);
    rect(M + 18, chartY + 48, chartWidth - 36, 4, rule);
    rect(M + 18, chartY + 48, (chartWidth - 36) * result.composite[element] / 100, 4, colors[element]); chartY += 75;
  });
  richText('综合倾向分 / 100，用于本次作答内部比较，不是人群百分位。', M + 18, chartY + 7, chartWidth - 36, 8.5, [], false, muted);
  rounded(rightX, panelsTop, textWidth, panelHeight, rgb(1,1,1), rule);
  let summaryY = panelsTop + 18;
  at('整体轮廓', rightX + 16, summaryY, 8.5, muted); summaryY += 26;
  for (const row of wrap(model.headline, textWidth - 32, 15, semibold)) { at(row, rightX + 16, summaryY, 15, ink, true); summaryY += 23; }
  summaryY += 15;
  richText(model.introduction, rightX + 16, summaryY, textWidth - 32, 10.1, model.overviewEmphasis);
  y = panelsTop + panelHeight + 24; quote(model.coreSentence || model.conclusion, colors[result.ranking[0]]);

  newPage('如何得到这个结果');
  title('如何得到这个结果', '先观察各自倾向，再理解情境中的取舍');
  cards([
    { title: '评分题 · 观察各自倾向', body: [reportMethod[0].text], emphasis: ['可以同时较高', '不需要彼此抵消'] },
    { title: '两两选择 · 观察取舍', body: [reportMethod[1].text], emphasis: ['给定情境', '选择可以不同'] },
  ]);
  section('四个观察角度');
  for (const element of ['wind', 'water', 'earth', 'fire'] as Element[]) {
    icon(element, M, y + 1, 20); at(elementInfo[element].name, M + 32, y, 11, colors[element], true);
    at(elementInfo[element].role, M + 62, y + 1, 10); y += 36;
  }
  y += 16; paragraph(reportMethod[2].text, 10.2, ink, true, ['完整作答', '不只凭总分']);
  paragraph(readingNote, 9, muted);
  paragraph('本问卷不是标准化心理测验，不提供人群常模、能力评定或诊断结论。', 9, muted);

  model.readings.forEach(reading => {
    newPage(reading.elements.map(e => elementInfo[e].name).join('与') + ' · 倾向解读');
    title(reading.title, reading.label, reading.elements);
    paragraph(reading.paragraphs[0], 11.2, ink, true, reading.emphasis);
    y += 8; cards(reading.cards, reading.cards.length === 3 ? 3 : 2, colors[reading.elements[0]]);
    reading.paragraphs.slice(1).forEach(text => paragraph(text, 11.2, ink, true, reading.emphasis));
    y += 18; quote(reading.keySentence, colors[reading.elements[0]]);
  });

  newPage('这些倾向如何协同');
  title(model.integration[0]?.title || '这些倾向如何协同', '四个角色，可以呼应，也可以随情境切换');
  model.integration.slice(0, 1).forEach(part => paragraph(part.text, 11.2, ink, true, model.integrationEmphasis));
  y += 14; cards(model.integrationCards, 2);
  model.integration.slice(1).forEach(part => paragraph(part.text, 11.2, ink, true, model.integrationEmphasis));

  newPage('最后的轮廓');
  title('把自己看作一个整体', '比选择一个标签，更值得保留的是其中的联系');
  paragraph(model.conclusion, 11.5, ink, true, model.conclusionEmphasis);
  y += 18; cards(model.closingCards, 3, colors[result.ranking[0]]);
  if (model.reflection) { y += 12; section('留给自己的观察'); paragraph(model.reflection); }
  y = Math.max(y + 28, 670);
  paragraph('这是一份基于本次作答的探索性描述，请结合自己的经历理解，不必把它当作固定标签。', 9, muted);
  paragraph(options.ai ? '文字解读由 DeepSeek 根据完整作答生成；计分、图表与文字 PDF 由网站生成。' : '本地基础解读预览，未调用人工智能服务。', 8.5, muted, true);

  const pages = doc.getPages();
  pages.forEach((item, i) => { page = item; line(798); at('星象测试 · 个人倾向报告', M, 808, 7, muted); right(`${i + 1} / ${pages.length}`, W - M, 808, 7, muted); });
  const bytes = await doc.save();
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}
