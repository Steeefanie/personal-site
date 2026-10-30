import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildAiEvidence, validateAiReport } from '../src/lib/four-elements-ai.ts';
import { buildNarrativeReport } from '../src/lib/four-elements-report.ts';
import { scoreAnswers } from '../src/lib/four-elements.ts';
import { createReportServer } from '../services/four_elements_api/server.mjs';
import { mockAiReport } from './fixtures/four-elements/ai-response.mjs';
const input = JSON.parse(readFileSync(new URL('./fixtures/four-elements/input.json', import.meta.url)));
const answers = [...input.likert, ...input.forced];

test('provider evidence contains all 48 original questions, answers and both forced options', () => {
  const evidence = buildAiEvidence(answers);
  assert.equal(evidence.questionnaire.length, 48);
  assert.equal(evidence.scale[3], '一半一半');
  for (const q of evidence.questionnaire) {
    assert.equal(q.answer, answers[q.id - 1]); assert.ok(q.question.length > 5);
    if (q.id > 36) { assert.ok(q.options.A.text); assert.ok(q.options.B.text); assert.equal(q.selectedText, q.options[q.answer].text); }
  }
  assert.deepEqual(evidence.scores, scoreAnswers(answers));
});

test('AI validation rejects missing elements, mismatched evidence and untrusted text', () => {
  assert.equal(validateAiReport(mockAiReport()).elements.length, 4);
  for (const edit of [r => r.elements.pop(), r => r.elements[0].evidenceIds = [3, 7], r => r.conflicts[0].evidenceIds = [37, 43], r => r.overview.headline = '<script>不可信内容</script>', r => r.overview.summary += ' 分数是99', r => r.integration.evidenceIds = [49, 50, 51]]) {
    const report = mockAiReport(); edit(report); assert.throws(() => validateAiReport(report));
  }
});

test('shared report model uses generated prose and preserves authoritative numbers', () => {
  const score = scoreAnswers(answers), ai = mockAiReport(), model = buildNarrativeReport(score, ai);
  assert.equal(model.source, 'ai'); assert.equal(model.headline, ai.overview.headline);
  assert.deepEqual(model.profiles[0].paragraphs, ai.elements[0].paragraphs);
  assert.equal(model.pairs[0].text, ai.conflicts[0].interpretation);
  assert.deepEqual(score, scoreAnswers(answers));
});

async function service(t, overrides = {}, fetchImpl) {
  const server = createReportServer({ env: { DEEPSEEK_API_KEY: 'test-only-not-a-key', ...overrides }, fetchImpl });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/v1/four-elements/report`;
  return (body = { answers, consent: true }, origin = 'http://localhost:4322') => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
}
const completion = () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(mockAiReport()) } }] });

test('API recomputes evidence, uses fixed upstream and coalesces identical requests', async t => {
  let calls = 0;
  const post = await service(t, {}, async (url, options) => {
    calls++; assert.equal(url, 'https://api.deepseek.com/chat/completions');
    const payload = JSON.parse(options.body), evidence = JSON.parse(payload.messages[1].content);
    assert.equal(evidence.questionnaire.length, 48); assert.equal(payload.response_format.type, 'json_object');
    await new Promise(resolve => setTimeout(resolve, 15)); return completion();
  });
  const responses = await Promise.all([post(), post()]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(calls, 1);
  assert.equal((await responses[0].json()).report.version, 'deepseek-report-v3');
  assert.equal((await post()).status, 200); assert.equal(calls, 2); // Completed reports are never cached on the server.
});

test('API checks consent, rejects client-supplied scores and enforces origin', async t => {
  let calls = 0;
  const post = await service(t, {}, async () => { calls++; return completion(); });
  assert.equal((await post({ answers, consent: false })).status, 400);
  assert.equal((await post({ answers, consent: true, scores: {} })).status, 400);
  assert.equal((await post({ answers: answers.slice(1), consent: true })).status, 400);
  assert.equal((await post(undefined, 'https://unrelated.example')).status, 403);
  assert.equal(calls, 0);
});

test('unconfigured or invalid provider results remain explicit failures without leaking details', async t => {
  const missing = await service(t, { DEEPSEEK_API_KEY: '' }, async () => { throw new Error('must not call'); });
  assert.equal((await missing()).status, 503);
  const invalid = await service(t, {}, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: 'private-upstream-error' } }] }));
  const response = await invalid(); assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private-upstream-error|test-only-not-a-key/);
});

test('API enforces IP and paid-call daily limits', async t => {
  const perIp = await service(t, { FOUR_ELEMENTS_HOURLY_LIMIT: '1' }, async () => completion());
  assert.equal((await perIp()).status, 200); assert.equal((await perIp()).status, 429);
  const daily = await service(t, { FOUR_ELEMENTS_DAILY_LIMIT: '1' }, async () => completion());
  assert.equal((await daily()).status, 200);
  const changed = [...answers]; changed[0] = 1;
  assert.equal((await daily({ answers: changed, consent: true })).status, 429);
});


test('generated chapters must cover all elements once and match the scored reading groups', () => {
  assert.doesNotThrow(() => validateAiReport(mockAiReport(), answers));
  const missing = mockAiReport(); missing.readings.pop();
  assert.throws(() => validateAiReport(missing));
  const wrong = mockAiReport(); wrong.readings.reverse();
  assert.throws(() => validateAiReport(wrong, answers));
  const tooLong = mockAiReport(); tooLong.readings[0].paragraphs = Array(4).fill('这段文字用于检查报告篇幅是否超限。'.repeat(15));
  assert.throws(() => validateAiReport(tooLong));
});


test('group readings accept related forced-choice evidence and reject unrelated pairs', () => {
  const report = mockAiReport(); report.readings[1].evidenceIds = [3, 14, 42, 48];
  assert.doesNotThrow(() => validateAiReport(report, answers));
  report.readings[0].evidenceIds = [1, 6, 42];
  assert.throws(() => validateAiReport(report, answers));
});


test('card layouts enforce counts and paired element ownership; emphasis stays literal', () => {
  const report = mockAiReport(); report.readings[0].cards.pop();
  assert.throws(() => validateAiReport(report));
  const mixed = mockAiReport(); mixed.readings[1].cards[0].element = 'fire';
  assert.throws(() => validateAiReport(mixed));
  const keywords = mockAiReport(); keywords.readings[0].cards[0].emphasis = ['not present', '自动测试'];
  assert.deepEqual(validateAiReport(keywords).readings[0].cards[0].emphasis, ['自动测试']);
});
