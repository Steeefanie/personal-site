import { emphasisRuns, type ReportEmphasis } from '../lib/report-emphasis';

export function reportNode<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export function richReportParagraph(text: string, emphasis: ReportEmphasis = [], className?: string) {
  const p = reportNode('p', undefined, className);
  emphasisRuns(text, emphasis).forEach(run => p.append(run.bold ? reportNode('strong', run.text) : document.createTextNode(run.text)));
  return p;
}
export function reportProse(paragraphs: string[], emphasis: ReportEmphasis = []) {
  const body = reportNode('div', undefined, 'prose fe-reading-prose');
  paragraphs.filter(text => text.trim()).forEach(text => body.append(richReportParagraph(text, emphasis)));
  return body;
}
export type ReportCardView = { title: string; body: string[]; emphasis: ReportEmphasis; label?: string; accent?: string; nuance?: string };
export function reportCardGrid<T extends ReportCardView>(cards: T[], layout: string, labelContent?: (card: T, index: number) => Node) {
  const grid = reportNode('div', undefined, `fe-content-cards fe-cards-${layout}`);
  cards.forEach((card, index) => {
    const item = reportNode('article', undefined, 'fe-content-card');
    if (card.accent) item.style.setProperty('--element', card.accent);
    const label = reportNode('div', undefined, 'fe-card-label');
    if (labelContent) label.append(labelContent(card, index));
    else label.textContent = card.label || String(index + 1).padStart(2, '0');
    item.append(label, reportNode('h3', card.title));
    const body = reportNode('div', undefined, 'fe-card-prose');
    card.body.forEach(text => body.append(richReportParagraph(text, card.emphasis)));
    if (card.nuance) body.append(richReportParagraph(card.nuance, card.emphasis, 'fe-card-nuance'));
    item.append(body); grid.append(item);
  });
  return grid;
}
