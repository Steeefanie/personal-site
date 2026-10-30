import assert from 'node:assert/strict';
import test from 'node:test';
import { readerFacingText } from '../src/lib/seven-traits-reader-text.ts';
import { validateAiReport } from '../src/lib/seven-traits-ai.ts';
import { buildReportModel } from '../src/lib/seven-traits-report.ts';
import { scoreAnswers } from '../src/lib/seven-traits.ts';
import { mockAiReport } from './fixtures/seven-traits/ai-response.mjs';

test('remove evidence-audit sentences without replacing the original analysis', () => {
  const analysis = '吸引出现时的感受，与你之后是否行动、怎样行动，并不完全是一回事。';
  for (const sentence of [
    '缺少你在吸引出现后实际如何评估后果的信息。',
    '尚不清楚决定之后的实际结果。',
    '题目无法提供真实行为的全部背景。',
    '现有回答没有说明你的实际行动。',
    '不过，尚不了解资源余量、对象关系及已有责任。',
    '缺少你对亲近朋友获得你想要资源时真实感受的持续观察。',
    '缺少你在多大程度上意识到自身选择对他人机会的影响。',
    '缺少你在暧昧初期如何确认双方意愿的具体做法。',
    '缺少事前讨论过程，无法确认开放发生在哪个阶段。',
  ]) {
    assert.equal(readerFacingText(sentence), '');
    assert.equal(readerFacingText(analysis + sentence), analysis);
  }
  assert.equal(readerFacingText('但两者也可能独立运作，当前回答无法确认它们是否总在同一情境中出现。'), '但两者也可能独立运作。');
});

test('preserve meaningful conditions, negations, questions and natural caution', () => {
  for (const text of [
    '缺少明确截止时间时，你可能更难开始任务。',
    '缺少你的帮助时，对方可能会先寻找其他支持。',
    '缺少实践经历并不意味着你没有学习的能力。',
    '信息不足时，你可能先确认边界，再作出决定。',
    '尚不清楚自己想要什么时，可以给选择留一点时间。',
    '你重视落地，但未必偏爱稳定。',
    '这可能与情境变化有关，并不意味着每次都会作出相同选择。',
    '你在下一次共同决定中，会怎样表达自己的界限？',
  ]) assert.equal(readerFacingText(text), text);
});

test('optional supplements stay empty and existing report prose is cleaned consistently', () => {
  const report = mockAiReport();
  report.dimensions.forEach(d => { d.nuance = ''; });
  report.pairs.forEach(p => { delete p.uncertainty; });
  const valid = validateAiReport(report);
  assert.ok(valid.dimensions.every(d => d.nuance === ''));
  assert.ok(valid.pairs.every(p => p.uncertainty === ''));
  const audit = '缺少你在吸引出现后实际如何评估后果的信息。';
  valid.overview.summary += audit;
  valid.dimensions[0].nuance = audit;
  valid.pairs[0].interpretation += audit;
  valid.integration.paragraphs.push(audit);
  valid.integration.cards[0].body.push(audit);
  valid.actions[0].text += audit;
  valid.closing.summary += audit;
  const before = JSON.stringify(valid);
  const model = buildReportModel(scoreAnswers(Array(56).fill(3)), valid);
  assert.equal(JSON.stringify(valid), before);
  assert.equal(model.profiles[0].nuance, '');
  assert.equal(JSON.stringify(model).includes(audit), false);
  assert.equal(model.chapters.length, 7);
  const broken = mockAiReport(); broken.dimensions[0].paragraphs = [''];
  assert.throws(() => validateAiReport(broken));
});
