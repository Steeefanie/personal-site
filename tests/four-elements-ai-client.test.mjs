import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiReportClient } from '../src/scripts/four-elements-ai.ts';
import { mockAiReport, sampleAnswers, syntheticPairedAnswers } from './fixtures/four-elements/ai-response.mjs';
import { validateAiReport } from '../src/lib/four-elements-ai.ts';
const answers = sampleAnswers;
function setup(t, fetchImpl) {
  const storage = new Map();
  t.mock.method(globalThis, 'fetch', fetchImpl);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k),
  } });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'localStorage', descriptor) : delete globalThis.localStorage);
  return storage;
}
const response = () => Response.json({ report: mockAiReport(), model: 'test-model', generatedAt: '2026-10-29T12:00:00Z' });
test('submit sends complete answers and restores the validated report locally', async t => {
  setup(t, async (_, options) => {
    assert.deepEqual(JSON.parse(options.body), { answers, consent: true });
    return response();
  });
  const client = createAiReportClient(() => answers);
  assert.equal(client.getReport(), undefined);
  await client.generate();
  assert.deepEqual(client.getReport(), validateAiReport(mockAiReport()));
  assert.deepEqual(client.getReport().overview.emphasis, []); // Repeated labels remain ordinary text.
  assert.deepEqual(createAiReportClient(() => answers).getReport(), client.getReport());
});
test('failed generation does not create a result and can retry the same submitted answers', async t => {
  let calls = 0;
  setup(t, async () => ++calls === 1 ? Response.json({ error: '服务暂不可用' }, { status: 503 }) : response());
  const client = createAiReportClient(() => answers);
  await assert.rejects(client.generate(), /服务暂不可用/);
  assert.equal(client.getReport(), undefined);
  await client.generate();
  assert.ok(client.getReport());
});
test('clearing pending generation prevents a late response from restoring deleted data', async t => {
  let resolve;
  const storage = setup(t, () => new Promise(done => { resolve = done; }));
  const client = createAiReportClient(() => answers), pending = client.generate();
  client.invalidate();
  resolve(response());
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(client.getReport(), undefined);
  assert.equal(storage.size, 0);
});

test('HTML proxy failures identify the HTTP status without exposing response bodies', async t => {
  setup(t, async () => new Response('<html>private proxy diagnostics</html>', { status: 502 }));
  const client = createAiReportClient(() => answers);
  await assert.rejects(client.generate(), error => /HTTP 502/.test(error.message) && !error.message.includes('private'));
  assert.equal(client.getReport(), undefined);
});

test('an HTML page returned instead of the report API remains an explicit failure', async t => {
  setup(t, async () => new Response('<html>site fallback</html>'));
  const client = createAiReportClient(() => answers);
  await assert.rejects(client.generate(), /报告接口返回内容异常/);
  assert.equal(client.getReport(), undefined);
});

test('v3 stays read-only and calling generate cannot replace it or start a paid request', async t => {
  let calls = 0;
  const values = syntheticPairedAnswers(), old = mockAiReport({ answers: values, version: 'deepseek-report-v3' });
  const storage = setup(t, async () => { calls++; return Response.json({ error: '模拟生成失败' }, { status: 502 }); });
  const key = 'four-elements-ai-v1', record = JSON.stringify({ answersKey: JSON.stringify(values), report: old, model: 'old-model', generatedAt: '2026-10-30T00:00:00Z' });
  storage.set(key, record);
  const client = createAiReportClient(() => values);
  assert.equal(calls, 0);
  assert.equal(client.getReport().version, 'deepseek-report-v3');
  assert.deepEqual(client.getReport().readings.map(r => r.elements.length), [3, 1]);
  await client.generate();
  assert.equal(calls, 0); assert.equal(storage.get(key), record);
  assert.equal(client.getReport().version, 'deepseek-report-v3');
});

test('v4 generation requires clearing old data and completing a new answer sheet', async t => {
  let values = syntheticPairedAnswers(), calls = 0;
  const old = mockAiReport({ answers: values, version: 'deepseek-report-v3' });
  const storage = setup(t, async () => { calls++; return Response.json({ report: mockAiReport({ answers: values }), model: 'new-model', generatedAt: '2026-10-31T00:00:00Z' }); });
  storage.set('four-elements-ai-v1', JSON.stringify({ answersKey: JSON.stringify(values), report: old, model: 'old-model', generatedAt: '2026-10-30T00:00:00Z' }));
  const client = createAiReportClient(() => values);
  client.invalidate(); values = Array(48).fill(null);
  await assert.rejects(client.generate(), /完成全部题目/);
  assert.equal(calls, 0); assert.equal(client.getReport(), undefined);
  values = syntheticPairedAnswers();
  await client.generate();
  assert.equal(calls, 1);
  assert.equal(client.getReport().version, 'deepseek-report-v4');
  assert.deepEqual(client.getReport().readings.map(r => r.elements.length), [2, 2]);
  assert.equal(createAiReportClient(() => values).getReport().version, 'deepseek-report-v4');
});
