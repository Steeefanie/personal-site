import bank from '../data/four-elements/question-bank.json' with { type: 'json' };

export const elements = ['wind', 'water', 'earth', 'fire'] as const;
export type Element = typeof elements[number];
export type Answer = number | 'A' | 'B' | null;
export type Answers = Answer[];
export type LikertQuestion = { id: number; type: 'likert'; text: string; element: Element };
export type ForcedQuestion = {
  id: number; type: 'forced_choice'; stem: string;
  options: Record<'A' | 'B', { text: string; element: Element }>;
};
export const questions = bank.questions as (LikertQuestion | ForcedQuestion)[];
export const labels = { ...bank.instructions.likert.labels, '3': '一半一半' };
export const elementInfo: Record<Element, { name: string; english: string; meaning: string; boundary: string; role: string }> = {
  wind: { name: '风', english: 'AIR', meaning: '认知探索 · 开放性', boundary: '风描述认知探索方式，不等于外向、话多或社交能力强。', role: '探索信息、连接观点和理解结构' },
  water: { name: '水', english: 'WATER', meaning: '情感感受 · 联结性', boundary: '水描述对感受与关系信息的敏感度，不等于情绪化或脆弱。', role: '感知情绪、关系和个人意义' },
  earth: { name: '土', english: 'EARTH', meaning: '稳定建构 · 落地性', boundary: '土描述秩序、持续与落地偏好，不等于保守或排斥新事物。', role: '关注资源、执行步骤和长期维护' },
  fire: { name: '火', english: 'FIRE', meaning: '驱动力 · 能动性', boundary: '火描述主动启动、决断与推进偏好；分数较低不等于懒惰或执行力差。', role: '启动行动、作出决定和推动变化' },
};

export function isValidAnswer(index: number, value: unknown): value is Exclude<Answer, null> {
  return index >= 0 && index < 48 && (index < 36
    ? typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    : value === 'A' || value === 'B');
}

export function isDraftAnswers(value: unknown): value is Answers {
  return Array.isArray(value) && value.length === 48
    && Array.from(value).every((answer, index) => answer === null || isValidAnswer(index, answer));
}

const round = (value: number, places = 4) => Number(value.toFixed(places));

// Round each intermediate value, following the reusable pack's Python scorer.
export function scoreAnswers(answers: Answers) {
  if (!Array.isArray(answers) || answers.length !== 48
    || !Array.from(answers).every((value, index) => isValidAnswer(index, value))) {
    throw new Error('请完成全部 48 题：前 36 题为 1—5 的整数，后 12 题为 A 或 B。');
  }
  const raw = Object.fromEntries(elements.map((element) => {
    const items = Object.fromEntries(questions.filter((q): q is LikertQuestion => q.type === 'likert' && q.element === element)
      .map((q) => [String(q.id), answers[q.id - 1] as number]));
    const values = Object.values(items);
    const sum = values.reduce((a, b) => a + b, 0);
    return [element, {
      sum, mean: round(sum / 9), normalized: round((sum - 9) / 36 * 100), items,
      max_items: Object.keys(items).filter((q) => items[q] === Math.max(...values)).map(Number),
      min_items: Object.keys(items).filter((q) => items[q] === Math.min(...values)).map(Number),
    }];
  })) as Record<Element, { sum: number; mean: number; normalized: number; items: Record<string, number>; max_items: number[]; min_items: number[] }>;
  const wins: Record<Element, number> = { wind: 0, water: 0, earth: 0, fire: 0 };
  const forced_detail: Record<string, { answer: 'A' | 'B'; element: Element }> = {};
  for (const question of questions) {
    if (question.type !== 'forced_choice') continue;
    const answer = answers[question.id - 1] as 'A' | 'B';
    const element = question.options[answer].element;
    wins[element]++;
    forced_detail[String(question.id)] = { answer, element };
  }
  const forced = Object.fromEntries(elements.map((e) => [e, { wins: wins[e], normalized: round(wins[e] / 6 * 100) }])) as Record<Element, { wins: number; normalized: number }>;
  const composite = Object.fromEntries(elements.map((e) => [e, round(0.8 * raw[e].normalized + 0.2 * forced[e].normalized)])) as Record<Element, number>;
  const total = Object.values(composite).reduce((a, b) => a + b, 0);
  // Forced choices always contribute 40 points across all four elements, even with all Likert answers at 1.
  const relative_share = Object.fromEntries(elements.map((e) => [e, round(composite[e] / total * 100, 2)])) as Record<Element, number>;
  const ranking = [...elements].sort((a, b) => composite[b] - composite[a]);
  const gap = composite[ranking[0]] - composite[ranking[1]];
  return {
    version: '1.0', raw, forced, forced_detail, composite, relative_share, ranking,
    ranking_zh: ranking.map((e) => elementInfo[e].name),
    dominance: gap >= 10 ? '主元素明显' : gap >= 5 ? '主元素较明确' : '主元素接近，宜按双主导或混合型解释',
    gap_first_second: round(gap),
    notes: [
      'relative_share 仅用于受测者内部四元素相对比较，不是心理学概率或人群百分位。',
      '本测评为探索性、娱乐性人格映射，不属于临床或标准化人格诊断。',
    ],
  };
}

export type Score = ReturnType<typeof scoreAnswers>;

// Descriptive item groups, not validated psychological subscales.
export const facets: Record<Element, { title: string; ids: number[] }[]> = {
  wind: [ { title: '兴趣探索与求新', ids: [1, 13, 21] }, { title: '原理、联系与建模', ids: [6, 17, 25, 33] }, { title: '观点开放与修正', ids: [9, 29] } ],
  water: [ { title: '情绪与关系感知', ids: [3, 11] }, { title: '记忆、内省与体验停留', ids: [7, 15, 23, 30] }, { title: '关系深度与感受权重', ids: [18, 26, 34] } ],
  earth: [ { title: '稳定偏好与长期维持', ids: [4, 12, 31] }, { title: '现实约束与步骤安排', ids: [8, 14, 19, 35] }, { title: '履约与方法复用', ids: [22, 27] } ],
  fire: [ { title: '兴趣启动与及时行动', ids: [2, 5, 36] }, { title: '带头、决断与推进', ids: [10, 16, 24, 28] }, { title: '挑战与强烈体验', ids: [20, 32] } ],
};

export function interpretElement(result: Score, element: Element) {
  const raw = result.raw[element];
  const groups = facets[element].map((facet) => ({
    ...facet, mean: facet.ids.reduce((sum, id) => sum + raw.items[String(id)], 0) / facet.ids.length,
  }));
  const strongest = [...groups].sort((a, b) => b.mean - a.mean)[0];
  const weakest = [...groups].sort((a, b) => a.mean - b.mean)[0];
  const values = Object.values(raw.items);
  const spread = Math.max(...values) - Math.min(...values);
  const descriptions: string[] = [];
  if (raw.mean >= 4) descriptions.push('这组主体题的回答整体偏向认同，相关偏好在本次自陈中较突出。');
  else if (raw.mean <= 2) descriptions.push('这组主体题的回答整体偏向不认同，相关偏好在本次自陈中较少体现。');
  else descriptions.push('这组主体题的平均回答处于中间范围，需要结合具体情境与条目差异理解。');
  if (strongest.mean - weakest.mean >= 1) {
    descriptions.push(`分组对照中，“${strongest.title}”（均分 ${strongest.mean.toFixed(2)}）比“${weakest.title}”（均分 ${weakest.mean.toFixed(2)}）更被你认同，不宜用一个笼统标签概括这组回答。`);
  } else descriptions.push('几个描述性分组的均分较接近，没有出现至少 1 分的组间差距。');
  if (spread >= 3) descriptions.push('组内最高与最低回答相差至少 3 分，说明不同条目的认同程度有较大差异；请优先看下面的具体回答。');
  else if (spread === 0) descriptions.push('这组 9 题的评分完全相同，无法从中区分更偏好的具体方面。');
  descriptions.push(`在涉及该元素的 6 次两两选择中，你选择了它 ${result.forced[element].wins} 次。这反映冲突情境下的相对取舍，不能直接当作能力高低。`);
  const tendency = raw.mean >= 4
    ? `你的回答较多体现出${elementInfo[element].role}的偏好。`
    : raw.mean <= 2
      ? `在本次回答中，${elementInfo[element].role}的偏好较少体现。`
      : `在${elementInfo[element].role}方面，你的回答整体居中，更适合结合具体情境理解。`;
  const distinction = spread === 0
    ? '这组各题评分相同，没有明显的内部差异。'
    : strongest.mean - weakest.mean >= 1
      ? `相比${weakest.title}，你更认同${strongest.title}。`
      : spread >= 3
        ? '不同条目的认同程度存在较大差异，可以展开查看具体作答。'
        : '';
  return { groups, descriptions, spread, summary: tendency + distinction };
}

export function summarizeResult(result: Score) {
  const first = result.ranking[0];
  const leaders = result.ranking.filter((e) => result.composite[first] - result.composite[e] < 5);
  const heading = leaders.length === 4 ? '四项倾向接近'
    : leaders.length > 1 ? `${leaders.map((e) => elementInfo[e].name).join('、')}倾向接近`
    : `${elementInfo[first].name}的综合倾向相对突出`;
  const last = result.ranking[3];
  const third = result.ranking[2];
  const likertTop = Math.max(...elements.map((e) => result.raw[e].normalized));
  const forcedTop = Math.max(...elements.map((e) => result.forced[e].wins));
  const likertLeaders = elements.filter((e) => result.raw[e].normalized === likertTop);
  const forcedLeaders = elements.filter((e) => result.forced[e].wins === forcedTop);
  const uniqueAgreement = likertLeaders.length === 1 && forcedLeaders.length === 1 && likertLeaders[0] === forcedLeaders[0];
  const overlap = likertLeaders.some((e) => forcedLeaders.includes(e));
  const alignment = uniqueAgreement ? '主体评分和两两选择的第一名一致，为同一倾向提供了两种题型的支持。'
    : overlap ? '两种题型的领先项有重合，同时存在并列，宜结合各项差距理解。'
    : '主体评分和两两选择的领先项不同，说明一般偏好与冲突情境下的取舍可能不同，不宜仅凭总分作单一判断。';
  return {
    heading, leaders,
    overview: leaders.length > 1
      ? '最高项与这些倾向的差距均小于 5 分，适合结合多项倾向理解，不宜硬判单一主元素。'
      : `第一名与第二名相差 ${result.gap_first_second.toFixed(2)} 分，按本测评设计规则，${result.dominance}。`,
    alignment,
    combination: result.ranking.map((e) => `${elementInfo[e].name}对应${elementInfo[e].role}`).join('；') + '。这些是理解行为偏好的观察角度，是否经常体现，应结合主体题的认同程度判断；相对靠前也不代表绝对倾向很强。',
    lowest: result.composite[third] - result.composite[last] < 5
      ? `${elementInfo[last].name}仅为相对最低，与第三项差距不足 5 分，不宜将它单独描述为弱项。`
      : `${elementInfo[last].name}在本次结果中相对较低，表示相关偏好较少被选择，不代表相应能力不足或某种人格“缺失”。`,
  };
}
