import { PDFDocument, PDFName, PDFString, rgb, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { loadReportFonts, type ReportFonts } from './report-fonts.ts';
import { wrapPdfText } from './report-pdf-text.ts';
import { layoutPdfRichText, drawPdfTextRows, pdfCardHeight, pdfNeedsPage, type PdfTextRow } from './report-pdf-layout.ts';
import { scoreAnswers, type Answers } from './seven-traits.ts';
import { radarGeometry } from './seven-traits-chart-layout.ts';
import { buildReportModel } from './seven-traits-report.ts';
import { validateAiReport, type AiReport } from './seven-traits-ai.ts';
import type { ReportEmphasis } from './report-emphasis.ts';

type Options = { fonts?: ReportFonts; date?: Date; logo?: Uint8Array };
type Card = { title: string; label?: string; body: string[]; emphasis: ReportEmphasis; nuance?: string; accent?: RGB };
let logoRequest: Promise<Uint8Array> | undefined;
function loadLogo() {
  return logoRequest ??= fetch('/images/seven-traits-emblem-v2.png').then(async response => {
    if (!response.ok) throw new Error('报告标志加载失败，请稍后重新保存。');
    return new Uint8Array(await response.arrayBuffer());
  }).catch(error => { logoRequest = undefined; throw error; });
}
const W = 595.28, H = 841.89, M = 50, CW = W - M * 2, BOTTOM = 775, START = 82;
const hex = (value: string) => rgb(...[1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number]);
const ink = hex('#25272d'), muted = hex('#777d86'), rule = hex('#dfe2e8'), pale = hex('#f6f7f9');
const sin = hex('#23486f'), virtue = hex('#aa4956');

/** Selectable Chinese text, vector figures, and the original PNG only as a cover mark. */
export async function createReportPdf(answers: Answers, ai: AiReport, options: Options = {}): Promise<Blob> {
  const result = scoreAnswers(answers), model = buildReportModel(result, validateAiReport(ai));
  const fonts = options.fonts ?? await loadReportFonts();
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const [regular, semibold] = await Promise.all([doc.embedFont(fonts.regular), doc.embedFont(fonts.semibold)]);
  const strings: string[] = [];
  const collect = (v: unknown) => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
  collect(model);
  for (const font of [regular, semibold]) {
    const supported = new Set(font.getCharacterSet());
    if (strings.some(s => [...s].some(c => c !== '\n' && !supported.has(c.codePointAt(0)!)))) throw new Error('解读中含报告字体暂不支持的字符，请重新生成后保存。');
  }
  const logo = await doc.embedPng(options.logo ?? await loadLogo());
  doc.setTitle('七宗罪与七美德 · 个人探索报告'); doc.setAuthor('Steeefanie');
  doc.setCreator('Steeefanie / Seven Traits Report'); doc.catalog.set(PDFName.of('Lang'), PDFString.of('zh-CN'));
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(options.date ?? new Date());
  let page!: PDFPage, y = START, chapter = '';
  const at = (text: string, x: number, top: number, size = 10, color = ink, bold = false) => page.drawText(text, { x, y: H - top - size, size, font: bold ? semibold : regular, color });
  const right = (text: string, end: number, top: number, size = 10, color = muted) => at(text, end - regular.widthOfTextAtSize(text, size), top, size, color);
  const line = (top: number, x = M, width = CW) => page.drawLine({ start: { x, y: H - top }, end: { x: x + width, y: H - top }, thickness: .6, color: rule });
  function newPage(label: string, continued = false) {
    chapter = label; page = doc.addPage([W, H]);
    at('Steeefanie  /  七宗罪与七美德', M, 32, 7.5, muted);
    right(label + (continued ? '（续）' : ''), W - M, 32, 7.5); line(53); y = START;
  }
  function ensure(height: number) { if (pdfNeedsPage(y, height, BOTTOM) && y > START) newPage(chapter, true); }
  const layout = (text: string, width: number, size: number, emphasis: ReportEmphasis = [], indent = false) => layoutPdfRichText(text, width, size, regular, semibold, emphasis, indent);
  function paragraph(text: string, size = 11.2, color = ink, indent = true, emphasis: ReportEmphasis = []) {
    if (!text.trim()) return;
    const block = layout(text, CW, size, emphasis, indent);
    let offset = 0;
    while (offset < block.rows.length) {
      let capacity = Math.floor((BOTTOM - y) / block.leading);
      if (capacity < Math.min(2, block.rows.length - offset)) { newPage(chapter, true); capacity = Math.floor((BOTTOM - y) / block.leading); }
      const rows = block.rows.slice(offset, offset + capacity);
      y += drawPdfTextRows(page, rows, M, y, size, color, regular, semibold, H);
      offset += rows.length;
      if (offset < block.rows.length) newPage(chapter, true);
    }
    y += 12;
  }
  function title(text: string, subtitle = '', size = 23) {
    const rows = wrapPdfText(text, CW, size, semibold);
    ensure(rows.length * size * 1.48 + 80);
    rows.forEach(row => { at(row, M, y, size, ink, true); y += size * 1.48; });
    if (subtitle) { y += 8; paragraph(subtitle, 9, muted, false); }
    y += 12;
  }
  function rounded(x: number, top: number, width: number, height: number) {
    const r = 10;
    page.drawSvgPath(`M${r} 0H${width-r}Q${width} 0 ${width} ${r}V${height-r}Q${width} ${height} ${width-r} ${height}H${r}Q0 ${height} 0 ${height-r}V${r}Q0 0 ${r} 0Z`, { x, y: H - top, color: pale });
  }
  function quote(text: string, accent = sin) {
    if (!text.trim()) return;
    const rows = layout(text, CW - 36, 12, [], false), height = rows.height + 28;
    ensure(height + 18); rounded(M, y, CW, height);
    page.drawRectangle({ x: M, y: H - y - height, width: 2, height, color: accent });
    drawPdfTextRows(page, rows.rows, M + 18, y + 14, 12, ink, semibold, semibold, H); y += height + 18;
  }
  function cards(items: Card[], columns = 2, spanLast = false) {
    for (let first = 0; first < items.length; first += columns) {
      const row = items.slice(first, first + columns), count = spanLast && row.length === 1 ? 1 : columns;
      const width = (CW - (count - 1) * 14) / count, size = 10.4;
      type CardLine = { row: PdfTextRow; cost: number; nuance: boolean };
      const states = row.map((card, index) => {
        const body = [...card.body, ...(card.nuance ? [card.nuance] : [])];
        const rows: CardLine[] = body.flatMap((text, paragraphIndex) => {
          const block = layout(text, width - 30, size, card.emphasis);
          return block.rows.map((row, i) => ({ row, cost: block.leading + (i === block.rows.length - 1 ? 10 : 0), nuance: paragraphIndex >= card.body.length }));
        });
        return { card, index, rows, offset: 0, continued: false, header: pdfCardHeight({ title: card.title, body: [] }, width, size, regular, semibold) };
      });
      const natural = Math.max(...states.map(s => s.header + s.rows.reduce((n, r) => n + r.cost, 0)));
      if (natural + 14 <= BOTTOM - START) ensure(natural + 14);
      while (states.some(s => s.offset < s.rows.length)) {
        ensure(Math.max(...states.map(s => s.header)) + 3 * size * 1.8 + 14);
        const available = BOTTOM - y - 14;
        const segments = states.map(state => {
          let height = state.header, end = state.offset;
          while (end < state.rows.length && height + state.rows[end].cost <= available) height += state.rows[end++].cost;
          return { state, height, end };
        });
        if (segments.some(s => s.state.offset < s.state.rows.length && s.end === s.state.offset)) { newPage(chapter, true); continue; }
        const height = Math.max(...segments.filter(s => s.end > s.state.offset).map(s => s.height));
        segments.forEach(({ state, end }) => {
          if (end === state.offset) return;
          const x = M + state.index * (width + 14), accent = state.card.accent ?? muted;
          rounded(x, y, width, height);
          page.drawRectangle({ x: x + 10, y: H - y - 2, width: width - 20, height: 2, color: accent });
          let top = y + 15;
          at((state.card.label || String(first + state.index + 1).padStart(2, '0')) + (state.continued ? '（续）' : ''), x + 15, top, 8, accent); top += 22;
          wrapPdfText(state.card.title, width - 30, 13, semibold).forEach(row => { at(row, x + 15, top, 13, ink, true); top += 19; }); top += 12;
          for (const row of state.rows.slice(state.offset, end)) {
            drawPdfTextRows(page, [row.row], x + 15, top, size, row.nuance ? muted : ink, regular, semibold, H); top += row.cost;
          }
          state.offset = end; state.continued = true;
        });
        y += height + 14;
        if (states.some(s => s.offset < s.rows.length)) newPage(chapter, true);
      }
    }
  }
  function radarFigure() {
    const figure = radarGeometry(result), scale = CW / figure.width, top = y;
    const p = (v: {x:number;y:number}) => ({ x: M + v.x * scale, y: H - top - v.y * scale });
    figure.grid.forEach(layer => layer.forEach((v, i) => page.drawLine({ start: p(v), end: p(layer[(i + 1) % layer.length]), color: rule, thickness: .5 })));
    figure.axes.forEach(v => page.drawLine({ start: p(figure.center), end: p(v), color: rule, thickness: .5 }));
    figure.sides.forEach((data, side) => {
      const color = side ? virtue : sin, center = p(figure.center);
      page.drawSvgPath(`M0 0 ${data.map(v=>`L${(v.x-figure.cx)*scale} ${(v.y-figure.cy)*scale}`).join(' ')} Z`, { x: center.x, y: center.y, color, opacity: .22, borderColor: color, borderOpacity: 1, borderWidth: 1 });
      data.forEach(v => page.drawCircle({ ...p(v), size: 2.2, color }));
    });
    figure.labels.forEach(label => {
      const point = p(label), size = 10;
      at(label.text, point.x - (label.side ? 0 : regular.widthOfTextAtSize(label.text, size)), H - point.y - size / 2, size, label.side ? virtue : sin);
    });
    y += figure.height * scale;
  }

  newPage('个人探索报告');
  page.drawImage(logo, { x: M + 100, y: H - 140 - 100, width: -100, height: 100 });
  y = 268; title('七宗罪与七美德', '', 30); paragraph('个人探索报告',18,muted,false);
  y += 20; title(model.headline,'',19); y += 14; quote(model.coreSentence);
  y = Math.max(y + 20, 704); paragraph(date,10,muted,false); paragraph('基于本次完整作答 · 仅供娱乐与自我探索',9,muted,false);
  newPage('结果总览'); title('结果总览', '十四维倾向 · 两侧可以同时存在');
  at('七宗罪侧',M,y,9,sin); at('七美德侧',M+90,y,9,virtue); y+=10; radarFigure();
  ensure(layout(model.summary,CW,11.2,model.overviewEmphasis,true).height+12);
  paragraph(model.summary,11.2,ink,true,model.overviewEmphasis);
  newPage('如何得到这个结果'); title('如何得到这个结果','先读具体回答，再理解维度间的联系');
  cards(model.methodParts.map(p=>({title:p.title,body:[p.text],emphasis:['独立计分','不互相抵消','全部题目与回答']})),2,true);
  paragraph(model.boundary,9,muted,false);
  for (const p of model.chapters) {
    newPage(`${p.a.name}与${p.b.name}`); title(p.title,`解读 ${String(p.index+1).padStart(2,'0')} / ${p.a.name}与${p.b.name}`);
    paragraph(p.observation,11.2,ink,true,p.emphasis);
    cards([p.a,p.b].map(d=>({title:d.title,label:`${d.name} / ${d.score.toFixed(1)} 分`,body:d.paragraphs,nuance:d.nuance,emphasis:d.emphasis,accent:d.index%2?virtue:sin})));
    paragraph(p.interpretation,11.2,ink,true,p.emphasis); paragraph(p.uncertainty,11.2,ink,true,p.emphasis);
    const tailHeight = layout(p.keySentence,CW-36,12).height+46+layout(p.question,CW,11.2).height+30;
    ensure(tailHeight); quote(p.keySentence);
    paragraph('留给自己的观察',9,muted,false); paragraph(p.question,11.2,ink,false);
  }
  newPage('综合解读'); title(model.integration.title,'把不同侧面放在一起理解');
  if (model.integration.paragraphs[0]) paragraph(model.integration.paragraphs[0],11.2,ink,true,model.integration.emphasis);
  cards(model.integration.cards,2,true);
  model.integration.paragraphs.slice(1).forEach(p=>paragraph(p,11.2,ink,true,model.integration.emphasis));
  newPage('最后的轮廓'); title('把自己看作一个整体','理解这次作答，而非给自己定性');
  paragraph(model.closing.summary,11.2,ink,true,model.closing.emphasis);
  cards(model.actions.map(a=>({title:a.title,label:'日常观察',body:[a.text],emphasis:[]})),2,true);
  ensure(layout(model.closing.reflection,CW-36,12).height+46+layout(model.boundary,CW,9).height+37);
  quote(model.closing.reflection);
  paragraph(model.boundary,9,muted,false);
  doc.getPages().forEach((item,index)=>{page=item;line(798);at('七宗罪与七美德 · 个人探索报告',M,808,7,muted);right(`${index+1} / ${doc.getPageCount()}`,W-M,808,7);});
  return new Blob([await doc.save() as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}
