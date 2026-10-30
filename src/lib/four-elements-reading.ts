import type { Element, Score } from './four-elements.ts';

/** Editorial grouping, not a validated psychological classification.
 * Compare every member with the first score to avoid chaining distant scores.
 */
export function readingGroups(result: Score): Element[][] {
  const groups: Element[][] = [];
  for (const element of result.ranking) {
    const group = groups.at(-1);
    if (group && result.composite[group[0]] - result.composite[element] <= 6) group.push(element);
    else groups.push([element]);
  }
  return groups;
}

export const reportMethod = [
  { title: '先看各自的倾向', text: '三十六道评分题分别观察四种偏好，每个元素包含九道题。它们可以同时较高，也可以同时较低，不需要彼此抵消。', emphasis: ['可以同时较高，也可以同时较低'] },
  { title: '再看具体情境的取舍', text: '十二道两两选择题补充观察：当两种偏好都可能成立时，在给定情境中更愿意保留哪一种。不同情境中的选择可以不同。', emphasis: ['不同情境中的选择可以不同'] },
  { title: '最后回到完整作答', text: '综合倾向分按评分题八成、两两选择两成计算。解读同时阅读全部题目与回答，关注内部差异和彼此联系，不只凭总分套用标签。', emphasis: ['关注内部差异和彼此联系，不只凭总分套用标签'] },
];
export const readingNote = '为方便阅读，相距不超过六分的倾向合并在同一解读章节，章节内始终与最高项比较。这只是编排规则，不是经过验证的分档标准；相对靠后也不表示能力不足。';

export type ReadingLayout = 'features' | 'paired' | 'contrast';
export function readingPlans(result: Score) {
  const groups = readingGroups(result);
  return groups.map((members, i) => ({ elements: members,
    layout: (members.length > 1 ? 'paired' : i === groups.length - 1 && groups.length > 1 ? 'contrast' : 'features') as ReadingLayout,
  }));
}
