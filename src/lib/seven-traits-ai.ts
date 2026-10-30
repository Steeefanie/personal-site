import { dimensions, labels, questions, reverseIds, scoreAnswers, type Answers } from './seven-traits.ts';
import { literalEmphasis } from './report-emphasis.ts';
export const aiReportVersion = 'seven-traits-deepseek-v2';
type Evidence = { evidenceIds: number[] };
export type ContentCard = Evidence & { title: string; body: string[]; emphasis: string[] };
export interface AiReport {
  version: typeof aiReportVersion;
  overview: Evidence & { headline: string; summary: string; coreSentence: string; emphasis: string[] };
  dimensions: (Evidence & { name: string; title: string; paragraphs: string[]; nuance: string; emphasis: string[] })[];
  pairs: (Evidence & { index: number; title: string; keySentence: string; emphasis: string[]; observation: string; interpretation: string; uncertainty: string; question: string })[];
  integration: Evidence & { title: string; paragraphs: string[]; cards: ContentCard[]; emphasis: string[] };
  closing: Evidence & { summary: string; reflection: string; emphasis: string[] };
  actions: (Evidence & { title: string; text: string })[];
}
export function validateAiReport(value: unknown): AiReport {
  let location = 'root';
  let textLength = 0;
  const fail = (reason = 'structure', bounds?: { length: number; min: number; max: number }): never => {
    throw new Error('AI 解读格式或题目依据不完整，请重试。', { cause: { code: 'invalid-report', field: location, reason, ...bounds } });
  };
  const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
  const text = (v: unknown, min: number, max: number) => {
    if (typeof v !== 'string') return fail('text-type');
    if (v.trim().length < min || v.length > max) return fail('text-length', { length: v.trim().length, min, max });
    if (/[<>\d\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v) || /\p{Extended_Pictographic}/u.test(v)) return fail('text-content');
    textLength += v.trim().length;
    if (textLength > 22000) return fail('report-length');
    return v.trim();
  };
  const ids = (v: unknown, allowed: readonly number[], min = 2, max = 12): number[] => {
    if (!Array.isArray(v) || !v.every(id => Number.isInteger(id) && allowed.includes(id))) return fail('evidence');
    const unique = [...new Set(v)] as number[];
    if (unique.length < min || unique.length > max) return fail('evidence');
    return unique;
  };
  const paragraphs = (v: unknown) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 3) return fail('paragraph-count');
    const body = v.map(p => text(p, 20, 280));
    return body;
  };
  const root = obj(value), allIds = questions.map(q => q.id);
  if (root.version !== aiReportVersion || !Array.isArray(root.dimensions) || root.dimensions.length !== 14
    || !Array.isArray(root.pairs) || root.pairs.length !== 7 || !Array.isArray(root.actions) || root.actions.length < 2 || root.actions.length > 3) return fail();
  const seen = new Set<string>();
  const profiles = root.dimensions.map(v => {
    location = 'dimensions';
    const d = obj(v), definition = dimensions.find(item => item.name === d.name);
    if (!definition || seen.has(definition.name)) return fail();
    seen.add(definition.name);
    location = `dimension:${definition.name}`;
    const profile = { name: definition.name, title: text(d.title, 2, 40), paragraphs: paragraphs(d.paragraphs), nuance: text(d.nuance === undefined ? '' : d.nuance, 0, 180), evidenceIds: ids(d.evidenceIds, definition.ids, 4, 4) };
    return { ...profile, emphasis: literalEmphasis(d.emphasis, [...profile.paragraphs, profile.nuance]) };
  });
  const pairSeen = new Set<number>();
  const pairs = root.pairs.map(v => {
    location = 'pairs';
    const p = obj(v), index = p.index;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 6 || pairSeen.has(index)) return fail();
    pairSeen.add(index);
    location = `pair:${index}`;
    const allowed = [...dimensions[index * 2].ids, ...dimensions[index * 2 + 1].ids];
    const pair = { index, title: text(p.title, 2, 45), keySentence: text(p.keySentence, 8, 100), observation: text(p.observation, 15, 180), interpretation: text(p.interpretation, 20, 240),
      uncertainty: text(p.uncertainty === undefined ? '' : p.uncertainty, 0, 180), question: text(p.question, 8, 120), evidenceIds: ids(p.evidenceIds, allowed, 8, 8) };
    return { ...pair, emphasis: literalEmphasis(p.emphasis, [pair.observation, pair.interpretation, pair.uncertainty]) };
  });
  const overview = obj(root.overview), integration = obj(root.integration);
  location = 'overview';
  const overviewText = { headline: text(overview.headline, 4, 45), summary: text(overview.summary, 40, 400), coreSentence: text(overview.coreSentence, 8, 100), evidenceIds: ids(overview.evidenceIds, allIds) };
  const overviewReport = { ...overviewText, emphasis: literalEmphasis(overview.emphasis, overviewText.summary) };
  location = 'integration';
  if (!Array.isArray(integration.cards) || integration.cards.length < 2 || integration.cards.length > 3) return fail('card-count');
  const integrationText = { title: text(integration.title, 3, 45), paragraphs: paragraphs(integration.paragraphs), evidenceIds: ids(integration.evidenceIds, allIds, 3) };
  const cards = integration.cards.map((value, index) => {
    location = `integration-card:${index}`;
    const card = obj(value);
    if (!Array.isArray(card.body) || card.body.length < 1 || card.body.length > 2) return fail('card-body');
    const body = card.body.map(p => text(p, 12, 180));
    const evidenceIds = ids(card.evidenceIds, allIds);
    const pairIndexes = evidenceIds.map(id => Math.floor(dimensions.findIndex(d => (d.ids as readonly number[]).includes(id)) / 2));
    if (new Set(pairIndexes).size < 2) return fail('integration-pair-coverage');
    return { title: text(card.title, 2, 40), body, evidenceIds, emphasis: literalEmphasis(card.emphasis, body) };
  });
  const integrationReport = { ...integrationText, cards, emphasis: literalEmphasis(integration.emphasis, integrationText.paragraphs) };
  location = 'closing';
  const closing = obj(root.closing);
  const closingText = { summary: text(closing.summary, 25, 400), reflection: text(closing.reflection, 8, 120), evidenceIds: ids(closing.evidenceIds, allIds) };
  return { version: aiReportVersion,
    overview: overviewReport,
    dimensions: profiles, pairs,
    integration: integrationReport,
    closing: { ...closingText, emphasis: literalEmphasis(closing.emphasis, closingText.summary) },
    actions: root.actions.map((v, index) => { location = `action:${index}`; const a = obj(v); return { title: text(a.title, 2, 40), text: text(a.text, 20, 200), evidenceIds: ids(a.evidenceIds, allIds) }; }),
  };
}
export function buildAiEvidence(answers: Answers) {
  const scores = scoreAnswers(answers);
  return { questionnaireVersion: '1.2', reportVersion: aiReportVersion, referencePeriod: '过去一两年的通常实际表现',
    scale: Object.fromEntries(labels.map((label, i) => [i + 1, label])),
    questionnaire: questions.map(q => ({ id: q.id, question: q.text, answer: answers[q.id - 1], reverse: reverseIds.includes(q.id), dimension: dimensions.find(d => (d.ids as readonly number[]).includes(q.id))!.name })),
    scores,
    reportPlan: { dimensions: dimensions.map(d => ({ name: d.name, requiredEvidenceIds: [...d.ids] })),
      pairs: Array.from({ length: 7 }, (_, index) => ({ index, names: [dimensions[index * 2].name, dimensions[index * 2 + 1].name], requiredEvidenceIds: [...dimensions[index * 2].ids, ...dimensions[index * 2 + 1].ids] })),
      allowedEvidenceIds: questions.map(q => q.id) },
    caveat: '十四维独立计分；仅三十九、五十题反向。无常模、无诊断或道德评判意义。' };
}
