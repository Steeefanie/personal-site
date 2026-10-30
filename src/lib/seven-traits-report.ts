import { dimensions, reverseIds, type Result } from './seven-traits.ts';
import type { AiReport } from './seven-traits-ai.ts';
import { resolveEmphasis } from './report-emphasis.ts';
import { readerFacingText, readerFacingParagraphs } from './seven-traits-reader-text.ts';

/** One content model for the screen and PDF; authoritative numbers always come from scoring. */
export function buildReportModel(result: Result, ai: AiReport) {
  // Read existing caches through the same editorial cleanup as newly generated reports.
  ai = { ...ai,
    overview: { ...ai.overview, summary: readerFacingText(ai.overview.summary), coreSentence: readerFacingText(ai.overview.coreSentence) },
    dimensions: ai.dimensions.map(d => ({ ...d, paragraphs: readerFacingParagraphs(d.paragraphs), nuance: readerFacingText(d.nuance) })),
    pairs: ai.pairs.map(p => ({ ...p, observation: readerFacingText(p.observation), interpretation: readerFacingText(p.interpretation), uncertainty: readerFacingText(p.uncertainty), keySentence: readerFacingText(p.keySentence), question: readerFacingText(p.question) })),
    integration: { ...ai.integration, paragraphs: readerFacingParagraphs(ai.integration.paragraphs), cards: ai.integration.cards.map(c => ({ ...c, body: readerFacingParagraphs(c.body) })) },
    closing: { ...ai.closing, summary: readerFacingText(ai.closing.summary), reflection: readerFacingText(ai.closing.reflection) },
    actions: ai.actions.map(a => ({ ...a, text: readerFacingText(a.text) })),
  };
  const profiles = result.map(d => {
    const content = ai.dimensions.find(p => p.name === d.name)!;
    return { ...d, ...content, emphasis: resolveEmphasis(content.emphasis, [...content.paragraphs, content.nuance], [content.title, content.name]) };
  });
  const chapters = ai.pairs.slice().sort((a, b) => a.index - b.index).map(p => ({ ...p,
    emphasis: resolveEmphasis(p.emphasis, [p.observation, p.interpretation, p.uncertainty], [p.title, p.keySentence]),
    a: profiles[p.index * 2], b: profiles[p.index * 2 + 1] }));
  return {
    headline: ai.overview.headline, summary: ai.overview.summary, coreSentence: ai.overview.coreSentence, overviewEmphasis: resolveEmphasis(ai.overview.emphasis, ai.overview.summary, [ai.overview.headline, ai.overview.coreSentence]), overviewIds: ai.overview.evidenceIds,
    profiles, pairs: chapters, chapters,
    integration: { ...ai.integration, emphasis: resolveEmphasis(ai.integration.emphasis, ai.integration.paragraphs, [ai.integration.title]),
      cards: ai.integration.cards.map(c => ({ ...c, emphasis: resolveEmphasis(c.emphasis, c.body, [c.title]) })) },
    actions: ai.actions, closing: { ...ai.closing, emphasis: resolveEmphasis(ai.closing.emphasis, ai.closing.summary, [ai.closing.reflection]) },
    methodParts: [
      { title: '十四维独立计分', text: '每个维度有四道题，分别计算自己的倾向。七宗罪与七美德两侧可以同时较高或同时较低，对应维度不互相抵消。' },
      { title: '完整作答与解读依据', text: 'DeepSeek 依据全部题目与回答撰写解读，程序负责计分、配对和图表。七组关系按原问卷排列，不能仅凭一个分数判断真实行为或固定人格。' },
    ],
    method: '本报告依据七宗罪与七美德自编探索问卷 V1.2 的完整作答生成。每维四题，十四维独立计分；仅第三十九、五十题按六减原答反向计分。换算分为调整后均值减一再乘二十五，四舍五入保留一位小数。分数不是百分位、概率或道德得分。',
    boundary: '本问卷未经心理测量学验证，无样本常模。题量相等不意味着信度相等；自陈回答受情境和自我认识影响。解读由 DeepSeek 依据逐题作答生成，适合自我观察，不用于诊断、招聘筛选或重要人生决策。',
    definitions: dimensions.map(d => `${d.name}：${d.meaning}。`),
  };
}
export type ReportModel = ReturnType<typeof buildReportModel>;
export const evidenceText = (item: Result[number]['items'][number]) =>
  `第 ${item.id} 题：${item.text} 原答 ${item.raw} 分${reverseIds.includes(item.id) ? `，反向计入 ${item.adjusted} 分` : ''}。`;
