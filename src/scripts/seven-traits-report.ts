import { buildReportModel, evidenceText } from '../lib/seven-traits-report.ts';
import { type Result } from '../lib/seven-traits.ts';
import type { AiReport } from '../lib/seven-traits-ai.ts';
import { radar } from './seven-traits-chart.ts';
import { reportNode as node, reportProse as prose, reportCardGrid, richReportParagraph } from './report-dom';

export function renderReport(container: HTMLElement, result: Result, ai: AiReport) {
  const model = buildReportModel(result, ai);
  const chapter = (title: string, label: string, cls = '') => {
    const el = node('section', undefined, `fe-report-chapter st-section ${cls}`);
    el.append(node('p', label, 'fe-eyebrow'), node('h2', title)); return el;
  };
  const evidence = (items: Result[number]['items'], ids?: number[]) => {
    const detail = node('details', undefined, 'fe-report-sources'); detail.append(node('summary', '查看解读依据'));
    if (ids) detail.append(node('p', `解读引用第 ${ids.join('、')} 题。`, 'fe-small'));
    const list = node('ul'); items.forEach(q => list.append(node('li', evidenceText(q)))); detail.append(list); return detail;
  };
  container.replaceChildren();
  const heading = node('h2', model.headline, 'fe-editorial-title'); heading.tabIndex = -1;
  const editorial = node('section', undefined, 'fe-editorial-overview');
  editorial.append(node('p', '结果总览', 'fe-eyebrow'), heading, prose([model.summary], model.overviewEmphasis), node('blockquote', model.coreSentence, 'fe-core-sentence'));
  const chart = node('div', undefined, 'st-radar-panel fe-composite-chart');
  chart.append(node('p', '十四维倾向', 'fe-eyebrow'));
  const legend = node('div', undefined, 'st-chart-legend');
  legend.append(node('span', '七宗罪侧', 'st-legend-sin'), node('span', '七美德侧', 'st-legend-virtue'));
  chart.append(legend, radar(result), radar(result, true));
  editorial.append(chart);
  container.append(editorial);
  const method = node('details', undefined, 'fe-method'); method.append(node('summary', '如何得到这个结果'));
  const methodBody = node('div', undefined, 'fe-method-content');
  const methodNote = prose([model.boundary]);
  methodNote.classList.add('fe-method-note');
  methodBody.append(reportCardGrid(model.methodParts.map(p => ({ title: p.title, body: [p.text], emphasis: ['独立计分', '不互相抵消', '完整作答'] })), 'method'), methodNote);
  method.append(methodBody); container.append(method);
  model.chapters.forEach(p => {
    const section = chapter(p.title, `解读 ${String(p.index + 1).padStart(2, '0')} · ${p.a.name}与${p.b.name}`, 'st-pair');
    section.append(prose([p.observation], p.emphasis), reportCardGrid([p.a, p.b].map(d => ({ title: d.title, label: `${d.name} · ${d.score.toFixed(1)} 分`, body: d.paragraphs, nuance: d.nuance, emphasis: d.emphasis, accent: d.index % 2 ? 'var(--st-virtue)' : 'var(--st-sin)' })), 'dimensions'), prose([p.interpretation, p.uncertainty], p.emphasis), node('blockquote', p.keySentence, 'fe-reading-quote'));
    const question = node('div', undefined, 'st-observation-question');
    question.append(node('p', '留给自己的观察', 'fe-eyebrow'), richReportParagraph(p.question));
    section.append(question, evidence([...p.a.items, ...p.b.items], p.evidenceIds)); container.append(section);
  });
  const integration = chapter(model.integration.title, '综合解读');
  integration.append(prose(model.integration.paragraphs.slice(0, 1), model.integration.emphasis), reportCardGrid(model.integration.cards, 'integration'), prose(model.integration.paragraphs.slice(1), model.integration.emphasis));
  const integrationIds = [...new Set([...model.integration.evidenceIds, ...model.integration.cards.flatMap(c => c.evidenceIds)])];
  integration.append(evidence(model.profiles.flatMap(d => d.items).filter(q => integrationIds.includes(q.id)), integrationIds)); container.append(integration);
  const closing = chapter('把自己看作一个整体', '最后的轮廓', 'fe-reading-closing');
  closing.append(prose([model.closing.summary], model.closing.emphasis), reportCardGrid(model.actions.map(a => ({ title: a.title, body: [a.text], emphasis: [], label: '日常观察' })), 'closing'), node('blockquote', model.closing.reflection, 'fe-reflection'), node('p', model.boundary, 'fe-report-disclaimer'));
  const closingIds = [...new Set([...model.closing.evidenceIds, ...model.actions.flatMap(a => a.evidenceIds)])];
  closing.append(evidence(model.profiles.flatMap(d => d.items).filter(q => closingIds.includes(q.id)), closingIds)); container.append(closing);
  return heading;
}
