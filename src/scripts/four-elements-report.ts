import { elementInfo, questions, type Element, type Score } from '../lib/four-elements';
import { buildNarrativeReport } from '../lib/four-elements-report';
import { reportMethod, readingNote } from '../lib/four-elements-reading';
import { elementIconPaths } from '../lib/element-icons';
import { emphasisRuns } from '../lib/report-emphasis';
import type { AiReport, ReportCard } from '../lib/four-elements-ai';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function glyph(element: Element) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.entries({ viewBox: '0 0 24 24', width: '28', height: '28', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: `fe-${element}` }).forEach(([k,v]) => svg.setAttribute(k,v));
  elementIconPaths[element].forEach(d => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d);
    if (element === 'water') path.setAttribute('transform', 'translate(12 2.5) scale(1.066667) translate(-12 -2.5)');
    svg.append(path);
  });
  return svg;
}
function rich(text: string, emphasis: string[] = [], className?: string) {
  const p = node('p', undefined, className);
  emphasisRuns(text, emphasis).forEach(run => p.append(run.bold ? node('strong', run.text) : document.createTextNode(run.text)));
  return p;
}
function prose(paragraphs: string[], emphasis: string[] = []) {
  const body = node('div', undefined, 'prose fe-reading-prose');
  paragraphs.forEach(p => body.append(rich(p, emphasis)));
  return body;
}

function cardGrid(cards: ReportCard[], layout: string) {
  const grid = node('div', undefined, `fe-content-cards fe-cards-${layout}`);
  cards.forEach((card, i) => {
    const item = node('article', undefined, `fe-content-card${card.element ? ` fe-${card.element}` : ''}`);
    const label = node('div', undefined, 'fe-card-label');
    if (card.element) label.append(glyph(card.element), node('span', elementInfo[card.element].name));
    else label.append(node('span', String(i + 1).padStart(2, '0')));
    item.append(label, node('h3', card.title));
    const body = node('div', undefined, 'fe-card-prose');
    card.body.forEach(text => body.append(rich(text, card.emphasis)));
    item.append(body); grid.append(item);
  });
  return grid;
}

export function renderNarrativeReport(container: HTMLElement, result: Score, ai?: AiReport) {
  const model = buildNarrativeReport(result, ai);
  container.replaceChildren();
  const overview = node('section', undefined, 'fe-editorial-overview');
  overview.append(node('p', '结果总览', 'fe-eyebrow'));
  const heading = node('h2', model.headline, 'fe-editorial-title'); heading.tabIndex = -1;
  overview.append(heading, prose([model.introduction], model.overviewEmphasis));
  if (model.coreSentence) overview.append(node('blockquote', model.coreSentence, 'fe-core-sentence'));
  const chart = node('div', undefined, 'fe-chart fe-composite-chart');
  chart.setAttribute('aria-label', '四元素综合倾向分，满分一百分');
  chart.append(node('p', '四元素倾向', 'fe-eyebrow'));
  result.ranking.forEach(element => {
    const row = node('div', undefined, `fe-chart-row fe-${element}`);
    const name = node('strong', elementInfo[element].name); name.prepend(glyph(element));
    row.append(name, node('span', elementInfo[element].meaning, 'fe-chart-label'), node('b', result.composite[element].toFixed(1)));
    const track = node('div', undefined, 'fe-chart-track'), fill = node('span');
    fill.style.width = `${result.composite[element]}%`; track.append(fill); row.append(track); chart.append(row);
  });
  chart.append(node('p', '综合倾向分 / 100 · 用于本次作答内部比较', 'fe-small'));
  overview.append(chart); container.append(overview);

  const method = node('details', undefined, 'fe-method'); method.append(node('summary', '如何得到这个结果'));
  const methodContent = node('div', undefined, 'fe-method-content');
  const methodNote = prose([readingNote]);
  methodNote.classList.add('fe-method-note');
  methodContent.append(cardGrid(reportMethod.map(part => ({ title: part.title, body: [part.text],
    emphasis: ['可以同时较高', '不需要彼此抵消', '给定情境', '选择可以不同', '评分题八成', '两两选择两成', '全部题目与回答'],
  })), 'method'), methodNote, node('p', '仅供娱乐与自我探索，非标准化心理测验，不用于诊断。', 'fe-report-disclaimer'));
  method.append(methodContent);
  container.append(method);

  model.readings.forEach((reading, index) => {
    const chapter = node('section', undefined, 'fe-report-chapter fe-reading-chapter');
    chapter.append(node('p', `解读 ${String(index + 1).padStart(2, '0')} · ${reading.label}`, 'fe-eyebrow'));
    const icons = node('div', undefined, 'fe-chapter-icons'); reading.elements.forEach(e => icons.append(glyph(e)));
    chapter.classList.add(`fe-${reading.elements[0]}`);
    chapter.append(icons, node('h2', reading.title), prose([reading.paragraphs[0]], reading.emphasis), cardGrid(reading.cards, reading.layout), prose(reading.paragraphs.slice(1), reading.emphasis));
    chapter.append(node('blockquote', reading.keySentence, `fe-reading-quote fe-${reading.elements[0]}`));
    container.append(chapter);
  });

  const integration = node('section', undefined, 'fe-report-chapter');
  integration.append(node('p', '协同', 'fe-eyebrow'), node('h2', model.integration[0]?.title || '这些倾向如何协同'), prose(model.integration.slice(0, 1).map(p => p.text), model.integrationEmphasis), cardGrid(model.integrationCards, 'roles'), prose(model.integration.slice(1).map(p => p.text), model.integrationEmphasis));
  container.append(integration);
  const closing = node('section', undefined, 'fe-report-chapter fe-reading-closing');
  closing.append(node('p', '最后的轮廓', 'fe-eyebrow'), node('h2', '把自己看作一个整体'), prose([model.conclusion], model.conclusionEmphasis), cardGrid(model.closingCards, 'closing'));
  if (model.reflection) closing.append(node('blockquote', model.reflection, 'fe-reflection'));
  closing.append(node('p', '这是一份基于本次作答的探索性描述，请结合自己的经历理解，不必把它当作固定标签。', 'fe-report-disclaimer'));
  container.append(closing);

  const sources = node('details', undefined, 'fe-report-sources'); sources.append(node('summary', '查看解读依据'));
  model.profiles.forEach(profile => {
    sources.append(node('h3', elementInfo[profile.element].name));
    const list = node('ul');
    questions.filter(q => q.type === 'likert' && q.element === profile.element).forEach(q => {
      if (q.type === 'likert') list.append(node('li', `${q.id}. ${q.text} → ${result.raw[profile.element].items[String(q.id)]} 分`));
    });
    sources.append(list);
  });
  model.pairs.forEach(pair => { sources.append(node('h3', pair.title), node('p', pair.text), node('p', `对应第 ${pair.ids.join('、')} 题`, 'fe-small')); });
  container.append(sources);
  return heading;
}
