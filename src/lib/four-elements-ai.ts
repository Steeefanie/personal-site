import { elements, questions, scoreAnswers, type Answers, type Element } from './four-elements.ts';

import { readingGroups, readingPlans, type ReadingLayout } from './four-elements-reading.ts';

export const aiReportVersion = 'deepseek-report-v3';
export type ReportCard = { title: string; body: string[]; emphasis: string[]; element?: Element };
type Evidence = { evidenceIds: number[] };
export interface AiReport {
  version: typeof aiReportVersion;
  overview: Evidence & { headline: string; summary: string; coreSentence: string; emphasis: string[] };
  elements: (Evidence & { element: Element; title: string; paragraphs: string[]; nuance: string })[];
  conflicts: (Evidence & { pair: string; interpretation: string })[];
  readings: (Evidence & { elements: Element[]; title: string; paragraphs: string[]; keySentence: string; layout: ReadingLayout; cards: ReportCard[]; emphasis: string[] })[];
  integration: Evidence & { title: string; paragraphs: string[]; roles: ReportCard[]; emphasis: string[] };
  conclusion: Evidence & { summary: string; reflection: string; highlights: ReportCard[]; emphasis: string[] };
}
export type AiReportRecord = { answersKey: string; report: AiReport; model: string; generatedAt: string };
export const answerKey = (answers: Answers) => JSON.stringify(answers);

/** Validate structure and source IDs at both API and browser boundaries. */
export function validateAiReport(value: unknown, answers?: Answers): AiReport {
  let location = 'root';
  const fail = (reason = 'structure', bounds?: { length: number; min: number; max: number }): never => { throw new Error('AI 解读格式或题目依据不完整，请重试。', { cause: { code: 'invalid-report', field: location, reason, ...bounds } }); };
  const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
  const text = (v: unknown, min: number, max: number): string => {
    if (typeof v !== 'string') return fail('text-type');
    if (v.trim().length < min || v.length > max) return fail('text-length', { length: v.trim().length, min, max });
    if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v) || /\p{Extended_Pictographic}/u.test(v)
      || /\d/u.test(v)) return fail();
    return v.trim();
  };
  const evidence = (v: unknown, allowed: number[], min = 2, max = 12): number[] => {
    if (!Array.isArray(v) || v.length < min || v.length > max || new Set(v).size !== v.length
      || !v.every(id => Number.isInteger(id) && allowed.includes(id))) return fail('evidence');
    return v as number[];
  };
  const paragraphs = (v: unknown, max = 3) => {
    if (!Array.isArray(v) || v.length < 2 || v.length > max) return fail('paragraph-count');
    return v.map(p => text(p, 25, 280));
  };
  const emphasis = (value: unknown, body: string): string[] => {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length >= 2 && v.length <= 24 && body.includes(v)))].slice(0, 3);
  };
  const card = (value: unknown): ReportCard => {
    const p = object(value);
    if (!Array.isArray(p.body) || p.body.length < 1 || p.body.length > 3) return fail('card-body');
    const body = p.body.map(v => text(v, 12, 95));
    if (body.join('').length > 175) return fail('card-length');
    if (p.element !== undefined && !elements.includes(p.element as Element)) return fail('card-element');
    return { title: text(p.title, 2, 22), body, emphasis: emphasis(p.emphasis, body.join('')), ...(p.element ? { element: p.element as Element } : {}) };
  };
  const root = object(value);
  if (root.version !== aiReportVersion) return fail();
  const allIds = questions.map(q => q.id);
  const overview = object(root.overview), integration = object(root.integration), conclusion = object(root.conclusion);
  if (!Array.isArray(root.elements) || root.elements.length !== 4 || !Array.isArray(root.conflicts) || root.conflicts.length !== 6) return fail();
  const seen = new Set<string>();
  const profiles = root.elements.map(v => {
    const p = object(v), element = p.element as Element; location = 'elements';
    if (!elements.includes(element) || seen.has(element)) return fail();
    seen.add(element); location = `element:${element}`;
    const ownIds = questions.filter(q => q.type === 'likert' && q.element === element).map(q => q.id);
    return { element, title: text(p.title, 4, 45), paragraphs: paragraphs(p.paragraphs), nuance: text(p.nuance, 15, 180), evidenceIds: evidence(p.evidenceIds, ownIds, 2, 9) };
  });
  const pairs = new Map<string, number[]>();
  for (let i = 0; i < elements.length; i++) for (let j = i + 1; j < elements.length; j++) {
    const a = elements[i], b = elements[j];
    pairs.set(`${a}-${b}`, questions.filter(q => q.type === 'forced_choice'
      && [a, b].includes(q.options.A.element) && [a, b].includes(q.options.B.element)).map(q => q.id));
  }
  const pairSeen = new Set<string>();
  const conflicts = root.conflicts.map(v => {
    const p = object(v); location = 'conflicts';
    if (typeof p.pair !== 'string' || !pairs.has(p.pair) || pairSeen.has(p.pair)) return fail();
    pairSeen.add(p.pair); location = `pair:${p.pair}`;
    return { pair: p.pair, interpretation: text(p.interpretation, 25, 240), evidenceIds: evidence(p.evidenceIds, pairs.get(p.pair)!, 2, 2) };
  });
  if (!Array.isArray(root.readings) || root.readings.length < 1 || root.readings.length > 4) return fail();
  const covered = new Set<Element>();
  const readings = root.readings.map(v => {
    const p = object(v);
    if (!Array.isArray(p.elements) || !p.elements.length || p.elements.some(e => !elements.includes(e as Element) || covered.has(e as Element))) return fail();
    const members = p.elements as Element[]; location = `reading:${members.join('-')}`;
    members.forEach(e => covered.add(e));
    const allowed = questions.filter(q => q.type === 'likert' ? members.includes(q.element) : Object.values(q.options).some(option => members.includes(option.element))).map(q => q.id);
    const prose = paragraphs(p.paragraphs, 2);
    if (!['features', 'paired', 'contrast'].includes(p.layout as string) || !Array.isArray(p.cards)) return fail('layout');
    const layout = p.layout as ReadingLayout;
    const cards = p.cards.map(card);
    if (cards.length !== (layout === 'paired' ? members.length : layout === 'features' ? 3 : 2)) return fail('card-count');
    if (layout === 'paired' && cards.some((c, i) => c.element !== members[i])) return fail('card-members');
    if (cards.some(c => c.element && !members.includes(c.element))) return fail('card-members');
    if (members.length >= 3 && cards.some(c => c.body.join('').length > 95)) return fail('card-length');
    if (prose.join('').length + cards.flatMap(c => c.body).join('').length + String(p.keySentence).length > 620) return fail('chapter-length');
    if (prose.join('').length > 720) return fail('chapter-length', { length: prose.join('').length, min: 50, max: 720 });
    return { elements: members, title: text(p.title, 5, 45), paragraphs: prose,
      keySentence: text(p.keySentence, 15, 100), layout, cards, emphasis: emphasis(p.emphasis, prose.join('')), evidenceIds: evidence(p.evidenceIds, allowed, 2, 12) };
  });
  if (covered.size !== 4 || readings.flatMap(r => r.elements).length !== 4) return fail();
  if (answers && JSON.stringify(readings.map(r => r.elements)) !== JSON.stringify(readingGroups(scoreAnswers(answers)))) return fail();
  if (answers && JSON.stringify(readings.map(r => ({ elements: r.elements, layout: r.layout }))) !== JSON.stringify(readingPlans(scoreAnswers(answers)))) return fail('reading-plan');
  location = 'overview';
  const overviewResult = { headline: text(overview.headline, 6, 45), summary: text(overview.summary, 60, 180), coreSentence: text(overview.coreSentence, 15, 100), evidenceIds: evidence(overview.evidenceIds, allIds), emphasis: emphasis(overview.emphasis, String(overview.summary)) };
  location = 'integration';
  if (!Array.isArray(integration.roles) || integration.roles.length !== 4 || !Array.isArray(conclusion.highlights) || conclusion.highlights.length !== 3) return fail('closing-cards');
  const roles = integration.roles.map(card);
  if (new Set(roles.map(c => c.element)).size !== 4 || roles.some(c => !c.element)) return fail('role-elements');
  const integrationResult = { roles, emphasis: emphasis(integration.emphasis, Array.isArray(integration.paragraphs) ? integration.paragraphs.join('') : ''), title: text(integration.title, 5, 45), paragraphs: paragraphs(integration.paragraphs), evidenceIds: evidence(integration.evidenceIds, allIds, 3) };
  location = 'conclusion';
  const conclusionResult = { highlights: conclusion.highlights.map(card), emphasis: emphasis(conclusion.emphasis, String(conclusion.summary)), summary: text(conclusion.summary, 25, 180), reflection: text(conclusion.reflection, 15, 150), evidenceIds: evidence(conclusion.evidenceIds, allIds) };
  return { version: aiReportVersion, overview: overviewResult, elements: profiles, conflicts, readings, integration: integrationResult, conclusion: conclusionResult };
}

/** Full original questionnaire and selected answers, alongside authoritative scores. */
export function buildAiEvidence(answers: Answers) {
  const scores = scoreAnswers(answers);
  return {
    referencePeriod: '过去一两年的通常状态',
    scale: { '1': '完全不像我', '2': '比较不像我', '3': '一半一半', '4': '比较像我', '5': '非常像我' },
    questionnaire: questions.map(q => q.type === 'likert'
      ? { id: q.id, type: q.type, element: q.element, question: q.text, answer: answers[q.id - 1] }
      : { id: q.id, type: q.type, question: q.stem, options: q.options, answer: answers[q.id - 1], selectedText: q.options[answers[q.id - 1] as 'A' | 'B'].text }),
    scores,
    readingGroups: readingGroups(scores),
    readingPlan: readingPlans(scores),
    caveat: '本问卷为娱乐与自我探索，不是标准化心理测验，不能诊断或推断真实能力。',
  };
}
