import type { Element, Score } from './four-elements.ts';

type ReadingScore = Pick<Score, 'ranking' | 'composite'>;
export const groupingPolicy = { maxSpan: 6, chapterPenalty: 9, closeSpread: 10, epsilon: 1e-8 };

/** Kept only to validate and display existing v3 reports without rewriting them. */
export function legacyReadingGroups(result: ReadingScore): Element[][] {
  const groups: Element[][] = [];
  for (const element of result.ranking) {
    const group = groups.at(-1);
    if (group && result.composite[group[0]] - result.composite[element] <= 6) group.push(element);
    else groups.push([element]);
  }
  return groups;
}

/** Enumerate every contiguous partition; parameters are editorial, not psychometric. */
export function readingGroups(result: ReadingScore): Element[][] {
  const ranked = [...result.ranking].sort((a, b) => result.composite[b] - result.composite[a]);
  const score = (element: Element) => result.composite[element];
  const internalGap = (group: Element[]) => Math.max(0, ...group.slice(1).map((e, i) => score(group[i]) - score(e)));
  const candidates: { groups: Element[][]; cost: number }[] = [];
  for (let mask = 0; mask < 1 << (ranked.length - 1); mask++) {
    const groups: Element[][] = [[ranked[0]]];
    ranked.slice(1).forEach((element, i) => {
      if (mask & 1 << i) groups.push([element]);
      else groups.at(-1)!.push(element);
    });
    if (groups.some(g => score(g[0]) - score(g.at(-1)!) > groupingPolicy.maxSpan + groupingPolicy.epsilon)) continue;
    if (groups.slice(1).some((right, i) => {
      const left = groups[i], gap = score(left.at(-1)!) - score(right[0]);
      return gap <= Math.max(internalGap(left), internalGap(right)) + groupingPolicy.epsilon;
    })) continue;
    const deviation = groups.reduce((sum, g) => {
      const mean = g.reduce((total, e) => total + score(e), 0) / g.length;
      return sum + g.reduce((total, e) => total + (score(e) - mean) ** 2, 0);
    }, 0);
    candidates.push({ groups, cost: deviation + groupingPolicy.chapterPenalty * groups.length });
  }
  candidates.sort((a, b) => {
    if (Math.abs(a.cost - b.cost) > groupingPolicy.epsilon) return a.cost - b.cost;
    if (a.groups.length !== b.groups.length) return a.groups.length - b.groups.length;
    for (let i = 0; i < a.groups.length; i++) if (a.groups[i].length !== b.groups[i].length) return b.groups[i].length - a.groups[i].length;
    return 0;
  });
  return candidates[0].groups;
}

export function readingPresentation(result: ReadingScore) {
  const groups = readingGroups(result);
  const values = Object.values(result.composite);
  const spread = Math.max(...values) - Math.min(...values);
  return { version: 'grouping-v2', groups, spread, overallClose: spread <= groupingPolicy.closeSpread + groupingPolicy.epsilon,
    boundaryGaps: groups.slice(1).map((g, i) => result.composite[groups[i].at(-1)!] - result.composite[g[0]]),
    mode: groups.length === 1 ? 'together' : groups.every(g => g.length === 1) ? 'individual' : 'grouped',
    caveat: '章节用于组织阅读，不代表心理层级、能力差异或固定的先后调用顺序。' };
}

export const reportMethod = [
  { title: '先看各自的倾向', text: '三十六道评分题分别观察四种偏好，每个元素包含九道题。它们可以同时较高，也可以同时较低，不需要彼此抵消。', emphasis: ['可以同时较高，也可以同时较低'] },
  { title: '再看具体情境的取舍', text: '十二道两两选择题补充观察：当两种偏好都可能成立时，在给定情境中更愿意保留哪一种。不同情境中的选择可以不同。', emphasis: ['不同情境中的选择可以不同'] },
  { title: '最后回到完整作答', text: '综合倾向分按评分题八成、两两选择两成计算。解读同时阅读全部题目与回答，关注内部差异和彼此联系，不只凭总分套用标签。', emphasis: ['关注内部差异和彼此联系，不只凭总分套用标签'] },
];
export const readingNote = '章节根据四项得分的接近程度与相互差距组织，仅用于方便阅读，不代表经过验证的心理分档。';
export const legacyReadingNote = '为方便阅读，相距不超过六分的倾向合并在同一解读章节，章节内始终与最高项比较。这只是编排规则，不是经过验证的分档标准；相对靠后也不表示能力不足。';

export type ReadingLayout = 'features' | 'paired' | 'contrast';
export function readingPlans(result: ReadingScore) {
  return readingGroups(result).map(members => ({ elements: members, layout: (members.length > 1 ? 'paired' : 'features') as ReadingLayout }));
}
export function legacyReadingPlans(result: ReadingScore) {
  const groups = legacyReadingGroups(result);
  return groups.map((members, i) => ({ elements: members,
    layout: (members.length > 1 ? 'paired' : i === groups.length - 1 && groups.length > 1 ? 'contrast' : 'features') as ReadingLayout,
  }));
}
