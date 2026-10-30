import { readFileSync } from 'node:fs';
import { questions, scoreAnswers } from '../../../src/lib/four-elements.ts';
import { readingPlans, legacyReadingPlans } from '../../../src/lib/four-elements-reading.ts';
const input = JSON.parse(readFileSync(new URL('./input.json', import.meta.url)));
export const sampleAnswers = [...input.likert, ...input.forced];
// Synthetic answers reproduce the four rounded scores, not the participant's answers.
export function syntheticPairedAnswers() {
  const remaining = { wind: 4, water: 6, earth: 3, fire: 6 }, chosen = new Map();
  return questions.map(q => {
    if (q.type === 'likert') { const extra = remaining[q.element]-- > 0 ? 1 : 0; return 3 + extra; }
    const key = Object.values(q.options).map(o => o.element).sort().join('-');
    const option = chosen.has(key) ? (q.options.A.element === chosen.get(key) ? 'B' : 'A') : 'A';
    chosen.set(key, q.options[option].element);
    return option;
  });
}
// Explicitly synthetic fixture, never a substitute for a real provider response.
export function mockAiReport({ answers = sampleAnswers, version = 'deepseek-report-v4' } = {}) {
  const paragraph = '这是一段仅用于自动测试的模拟解读，目的是检查逐题依据、内容布局和报告保存，并不代表真实模型生成的个人结论。';
  const card = (title, element) => ({ title, ...(element ? { element } : {}), body: ['这是一条仅供自动测试使用的卡片说明，不代表真实个性分析。'], emphasis: ['自动测试'] });
  return {
    version,
    overview: { headline: '自动测试专用的模拟解读标题', summary: paragraph + paragraph, coreSentence: '此句仅用于测试整体概括的布局，不代表真实人工智能分析。', emphasis: ['自动测试'], evidenceIds: [1, 5, 25] },
    elements: [ ['wind', [1, 6]], ['water', [3, 7]], ['earth', [4, 14]], ['fire', [2, 5]] ].map(([element, evidenceIds]) => ({ element, title: '自动测试使用的模拟元素解读标题', paragraphs: [paragraph, paragraph], nuance: '这是一条测试用的补充描述，只有真实调用后才能评价个性化解读质量。', evidenceIds })),
    conflicts: [['wind-water', [40, 46]], ['wind-earth', [41, 47]], ['wind-fire', [37, 43]], ['water-earth', [42, 48]], ['water-fire', [38, 44]], ['earth-fire', [39, 45]]].map(([pair, evidenceIds]) => ({ pair, interpretation: paragraph, evidenceIds })),
    readings: (version === 'deepseek-report-v3' ? legacyReadingPlans : readingPlans)(scoreAnswers(answers)).map(({ elements: members, layout }) => ({ elements: members, layout,
      cards: layout === 'paired' ? members.map(e => card('自动测试卡片', e)) : Array.from({ length: layout === 'features' ? 3 : 2 }, () => card('自动测试卡片')),
      emphasis: ['自动测试'], title: '自动测试使用的模拟分组解读标题', paragraphs: [paragraph, paragraph], keySentence: '这句话仅用于自动测试，不代表真实模型对个人作答的分析结论。',
      evidenceIds: members.flatMap(e => questions.filter(q => q.type === 'likert' && q.element === e).slice(0, 2).map(q => q.id)) })),
    integration: { roles: ['wind','water','earth','fire'].map(e => card('自动测试角色', e)), emphasis: ['自动测试'], title: '自动测试使用的模拟综合解读标题', paragraphs: [paragraph, paragraph], evidenceIds: [1, 5, 25] },
    conclusion: { highlights: Array.from({ length: 3 }, () => card('自动测试提醒')), emphasis: ['自动测试'], summary: paragraph, reflection: '这是一段测试用的观察提示，不应被当作真实模型对个人的判断。', evidenceIds: [1, 5] },
  };
}
