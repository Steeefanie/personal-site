import bank from '../data/seven-traits/question-bank.json' with { type: 'json' };

export const questions = bank.questions;
export type Answers = (number | null)[];
export const labels = ['完全不符合', '不太符合', '一般', '比较符合', '非常符合'];
export const rounds = ['本能反应', '欲望与自我约束', '行为惯性与真实选择', '自我认知与人际边界', '即时满足与长期选择', '自尊、利益与原则', '内在原则与最终校准'];
export const dimensions = [
  { name: '傲慢', ids: [1, 16, 25, 41], meaning: '能力优越感、对自身判断的信赖、渴望获得承认', action: '下次意见分歧时，先记录一条可能推翻自己判断的证据，再决定如何回应。' },
  { name: '谦卑', ids: [5, 19, 31, 45], meaning: '愿意听取反证、承认错误、认可他人贡献', action: '在下一次协作复盘中，分别写下自己的贡献、他人的贡献和需要修正的判断。' },
  { name: '嫉妒', ids: [2, 15, 30, 39], meaning: '社会比较、对机会和认可差异的不平衡感', action: '出现比较感受时，区分已知事实与自己的猜测，选一项自己能推进的具体目标。' },
  { name: '仁爱', ids: [8, 22, 37, 52], meaning: '同情、主动关心及非功利性帮助', action: '提供帮助前先确认对方的实际需要，并说明自己能够投入的时间范围。' },
  { name: '暴怒', ids: [3, 17, 32, 42], meaning: '受冒犯后的情绪激活、报复念头或即时反击倾向', action: '感到被冒犯时，先暂停即时回复，分别记录情绪、想法与最终采取的行动。' },
  { name: '耐心', ids: [6, 20, 38, 50], meaning: '面对反复沟通、打断、延误和错误时的平和与等待', action: '遇到反复追问时，尝试改用书面步骤，并约定集中沟通的时间。' },
  { name: '懒惰', ids: [4, 26, 33, 49], meaning: '任务推迟、低主动性、疲惫后的放弃', action: '选一项被推迟的任务，设置明确开始时间，只做第一个十分钟步骤，并记录是否启动。' },
  { name: '勤勉', ids: [12, 18, 46, 54], meaning: '主动启动、持续执行、克服困难', action: '为长期任务设置一个可检查的阶段成果，同时安排休息和调整计划的时间。' },
  { name: '贪婪', ids: [9, 23, 34, 43], meaning: '资源继续索取、机会占有和自身利益优先', action: '争取额外资源前，写下实际用途、已有份额及对他人合理机会的影响。' },
  { name: '慷慨', ids: [13, 28, 47, 55], meaning: '愿意共享资源、承担成本及让渡部分利益', action: '尝试分享一项自己能承受成本的资源，观察分享竞争性资源与一般帮助有何不同。' },
  { name: '暴食', ids: [10, 24, 35, 44], meaning: '过度娱乐、反复寻求感官满足、情绪性享受', action: '为一种常超时的娱乐设定结束提醒，记录结束时的满足感及第二天的状态。' },
  { name: '节制', ids: [7, 21, 40, 51], meaning: '限制消费、娱乐与即时享受的自主调节', action: '选一种日常享受，事先约定时间或预算，事后核对执行情况，避免一味压缩合理休息。' },
  { name: '色欲', ids: [11, 27, 36, 53], meaning: '亲密吸引对判断和行为的影响、追求短暂亲密', action: '受到强烈吸引时，给重要决定留出冷静时间，确认双方意愿、关系状态和已有承诺。' },
  { name: '贞洁', ids: [14, 29, 48, 56], meaning: '在亲密关系中尊重双方意愿、承诺及边界', action: '在关系中明确交流双方的意愿与约定，遇到变化时主动重新确认边界。' },
] as const;
export const reverseIds = [39, 50];
export const isValidAnswer = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
export function isDraftAnswers(value: unknown): value is Answers {
  return Array.isArray(value) && value.length === 56 && Array.from(value).every((v) => v === null || isValidAnswer(v));
}

export function scoreAnswers(answers: Answers) {
  if (!isDraftAnswers(answers) || !Array.from(answers).every(isValidAnswer)) throw new Error('请完成全部 56 题，每题选择 1—5 的整数。');
  return dimensions.map((dimension, index) => {
    const items = dimension.ids.map((id) => {
      const raw = answers[id - 1] as number;
      return { id, raw, adjusted: reverseIds.includes(id) ? 6 - raw : raw, text: questions[id - 1].text };
    });
    const mean = items.reduce((sum, item) => sum + item.adjusted, 0) / 4;
    // Four integer answers yield exact quarter means: positive half-up, never bankers' rounding.
    const score = Math.round((mean - 1) * 250) / 10;
    return { ...dimension, index, items, mean, score, spread: Math.max(...items.map((i) => i.adjusted)) - Math.min(...items.map((i) => i.adjusted)) };
  });
}
export type Result = ReturnType<typeof scoreAnswers>;

export function selectPairs(result: Result) {
  const pairs = Array.from({ length: 7 }, (_, i) => ({ a: result[i * 2], b: result[i * 2 + 1] }));
  // Reading order only: prioritize jointly endorsed pairs, then differences and item variation.
  return pairs.sort((x, y) => {
    const jointlyEndorsed = (pair: typeof x) => Number(pair.a.mean >= 4 && pair.b.mean >= 4);
    return jointlyEndorsed(y) - jointlyEndorsed(x)
      || Math.abs(y.a.score - y.b.score) - Math.abs(x.a.score - x.b.score)
      || Math.max(y.a.spread, y.b.spread) - Math.max(x.a.spread, x.b.spread);
  }).slice(0, 4);
}

// Clockwise from north; each paired axis is exactly 180 degrees apart.
export function axisAngle(index: number) {
  const left = (360 - (Math.floor(index / 2) + 0.5) * 180 / 7) % 360;
  return index % 2 === 0 ? left : (left + 180) % 360;
}
