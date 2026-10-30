import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAiEvidence, validateAiReport } from '../src/lib/seven-traits-ai.ts';
import { scoreAnswers, questions } from '../src/lib/seven-traits.ts';
import { buildReportModel } from '../src/lib/seven-traits-report.ts';
import { createReportServer } from '../services/four_elements_api/server.mjs';
import { mockAiReport } from './fixtures/seven-traits/ai-response.mjs';
const answers = Array(56).fill(3);
test('full original material and authoritative reverse scores are sent for all 56 questions', () => {
  const evidence = buildAiEvidence(answers);
  assert.equal(evidence.questionnaire.length, 56);
  evidence.questionnaire.forEach((q, i) => { assert.equal(q.question, questions[i].text); assert.equal(q.answer, 3); });
  assert.deepEqual(evidence.questionnaire.filter(q => q.reverse).map(q => q.id), [39, 50]);
  assert.equal(evidence.questionnaire[12].dimension, '慷慨');
  assert.equal(evidence.scale[3], '一般');
  assert.deepEqual(evidence.scores, scoreAnswers(answers));
});
test('validate all fourteen profiles and seven pairs with complete own-item evidence', () => {
  assert.equal(validateAiReport(mockAiReport()).dimensions.length, 14);
  for (const edit of [r => r.dimensions.pop(), r => r.dimensions[0].evidenceIds = [1, 5, 16, 25], r => r.pairs[0].evidenceIds.pop(), r => r.pairs[1].index = 0, r => r.overview.summary += '99', r => r.actions[0].text = '<script>bad</script>', r => r.dimensions[0].evidenceIds[0] = 57]) {
    const r = mockAiReport(); edit(r); assert.throws(() => validateAiReport(r));
  }
  const result = scoreAnswers(answers), report = buildReportModel(result, validateAiReport(mockAiReport()));
  assert.equal(report.pairs.length, 7); assert.equal(report.profiles.length, 14);
  assert.equal(report.headline, mockAiReport().overview.headline);
  assert.deepEqual(report.profiles.map(d => d.score), result.map(d => d.score));
  assert.deepEqual(report.chapters.flatMap(p => [p.a.name, p.b.name]), result.map(d => d.name));
  assert.equal(report.coreSentence, mockAiReport().overview.coreSentence);
});

test('v2 rejects old or incomplete contracts and strips nonliteral emphasis without dropping prose', () => {
  for (const edit of [r => r.version = 'seven-traits-deepseek-v1', r => delete r.closing, r => delete r.overview.coreSentence, r => r.integration.cards = [], r => r.integration.cards[0].evidenceIds = [100], r => r.closing.reflection = '<script>invalid</script>']) {
    const report = mockAiReport(); edit(report); assert.throws(() => validateAiReport(report));
  }
  const report = mockAiReport();
  report.overview.emphasis = ['实际经历', '实际经历', '这句话没有出现', '<b>markup</b>', 42];
  const valid = validateAiReport(report);
  assert.deepEqual(valid.overview.emphasis, ['实际经历']);
  assert.equal(valid.overview.summary, report.overview.summary);
  const input = buildAiEvidence(answers);
  assert.equal(input.reportVersion, 'seven-traits-deepseek-v2');
  assert.equal(input.reportPlan.dimensions.length, 14);
  assert.deepEqual(input.reportPlan.pairs.flatMap(p => p.names), valid.dimensions.map(d => d.name));
  assert.ok(input.reportPlan.pairs.every(p => p.requiredEvidenceIds.length === 8));
});
test('invalid reports expose structural diagnostics without retaining generated prose', () => {
  const report = mockAiReport();
  report.overview.summary = 'private-model-output';
  assert.throws(() => validateAiReport(report), error => {
    assert.deepEqual(error.cause, { code: 'invalid-report', field: 'overview', reason: 'text-length', length: 20, min: 40, max: 400 });
    assert.ok(!JSON.stringify(error.cause).includes(report.overview.summary));
    return true;
  });
  const badEvidence = mockAiReport();
  badEvidence.pairs[0].evidenceIds.pop();
  assert.throws(() => validateAiReport(badEvidence), error => error.cause?.code === 'invalid-report' && error.cause?.field === 'pair:0' && error.cause?.reason === 'evidence');
});

test('reasonable paragraph lengths and formatting preserve real reports without weakening evidence ownership', () => {
  const report = mockAiReport();
  report.dimensions[0].paragraphs = ['测'.repeat(24), '保留这段补充分析，用于验证短段落并不导致完整报告被拒绝。'];
  report.dimensions[1].paragraphs = [report.dimensions[1].paragraphs.join('')];
  report.dimensions[0].evidenceIds.push(report.dimensions[0].evidenceIds[0]);
  report.pairs[0].evidenceIds.push(report.pairs[0].evidenceIds[0]);
  const valid = validateAiReport(report);
  assert.equal(valid.dimensions[0].paragraphs[0], report.dimensions[0].paragraphs[0]);
  assert.equal(valid.dimensions[1].paragraphs.length, 1);
  assert.equal(valid.dimensions[0].evidenceIds.length, 4);
  assert.equal(valid.pairs[0].evidenceIds.length, 8);
  const shortCard = mockAiReport(); shortCard.dimensions[0].paragraphs = ['测'.repeat(24)];
  assert.equal(validateAiReport(shortCard).dimensions[0].paragraphs[0], '测'.repeat(24));
  for (const edit of [r => r.dimensions[0].paragraphs = ['测'.repeat(19)], r => r.dimensions[0].paragraphs = [''], r => r.dimensions[0].evidenceIds.pop(), r => r.pairs[0].evidenceIds[0] = 57]) {
    const broken = mockAiReport(); edit(broken); assert.throws(() => validateAiReport(broken));
  }
});

test('paragraph emphasis remains independent and integration evidence must span different pairs', () => {
  const report = mockAiReport();
  report.dimensions[0].paragraphs = ['你重视落地，但未必偏爱稳定，也能适应必要的变化。', '面对新的任务，如果信息不足，先确认边界可能比立即决定更合适。'];
  report.dimensions[0].emphasis = ['但未必偏爱稳定', '如果信息不足'];
  const valid = validateAiReport(report);
  assert.deepEqual(valid.dimensions[0].emphasis, report.dimensions[0].emphasis);
  const model = buildReportModel(scoreAnswers(answers), valid);
  assert.ok(model.profiles[0].emphasis instanceof Map);
  assert.ok([...model.profiles[0].emphasis.values()].every(ranges => ranges.length <= 1));
  const bad = mockAiReport(); bad.integration.cards[0].evidenceIds = [1, 5];
  assert.throws(() => validateAiReport(bad), error => error.cause?.field === 'integration-card:0' && error.cause?.reason === 'integration-pair-coverage');
});

test('report requests default to Flash and respect an explicitly configured model', async t => {
  for (const configuredModel of [undefined, 'configured-test-model']) {
    const expectedModel = configuredModel ?? 'deepseek-flash';
    const server = createReportServer({ env: { DEEPSEEK_API_KEY: 'test-only-not-a-key', ...(configuredModel ? { DEEPSEEK_MODEL: configuredModel } : {}) }, fetchImpl: async (_, options) => {
      assert.equal(JSON.parse(options.body).model, expectedModel);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(mockAiReport()) } }] });
    } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const base = `http://127.0.0.1:${server.address().port}/api/v1/seven-traits`;
    assert.equal((await (await fetch(`${base}/health`)).json()).model, expectedModel);
    const response = await fetch(`${base}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4322' }, body: JSON.stringify({ answers, consent: true }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).model, expectedModel);
  }
});

test('an upstream socket failure is explicit and never automatically retried', async t => {
  let calls = 0;
  const server = createReportServer({ env: { DEEPSEEK_API_KEY: 'test-only-not-a-key' }, fetchImpl: async () => {
    calls++;
    throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_SOCKET' } });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/seven-traits/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4322' }, body: JSON.stringify({ answers, consent: true }),
  });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /连接中断.*作答已保留/);
  assert.equal(calls, 1);
});

test('shared HTTP service routes seven-traits through fixed provider and rejects malformed or unconsented input', async t => {
  let calls = 0;
  const server = createReportServer({ env: { DEEPSEEK_API_KEY: 'test-only-not-a-key' }, fetchImpl: async (_, options) => {
    calls++; const payload = JSON.parse(options.body), material = JSON.parse(payload.messages[1].content);
    assert.equal(material.questionnaire.length, 56); assert.match(payload.messages[0].content, /七宗罪/);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(mockAiReport()) } }] });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/v1/seven-traits/report`;
  const post = (payload, origin = 'http://localhost:4322') => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(payload) });
  assert.equal((await post({ answers, consent: true })).status, 200);
  assert.equal((await post({ answers, consent: false })).status, 400);
  assert.equal((await post({ answers: answers.slice(1), consent: true })).status, 400);
  assert.equal((await post({ answers, consent: true, scores: [] })).status, 400);
  assert.equal((await post({ answers, consent: true }, 'https://unrelated.example')).status, 403);
  assert.equal(calls, 1);
});
