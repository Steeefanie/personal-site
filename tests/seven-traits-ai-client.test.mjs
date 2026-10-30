import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiReportClient } from '../src/scripts/seven-traits-ai.ts';
import { mockAiReport } from './fixtures/seven-traits/ai-response.mjs';
import { validateAiReport } from '../src/lib/seven-traits-ai.ts';
import { createDraftStore, draftStorageKey } from '../src/lib/seven-traits-draft.ts';
const answers = Array(56).fill(3);
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

test('editorial update drops all older report caches but preserves submitted answers without generating automatically', t => {
  let requests = 0;
  const storage = setup(t, () => { requests++; throw new Error('must not generate during migration'); });
  const store = createDraftStore(() => localStorage);
  assert.equal(store.save({ version: '1.2', answers, page: 6, completed: true, submitted: true }), true);
  const saved = storage.get(draftStorageKey);
  storage.set('seven-traits-ai-v1.2', JSON.stringify({ report: { ...mockAiReport(), version: 'seven-traits-deepseek-v1' }, answersKey: JSON.stringify(answers), model: 'legacy', generatedAt: '2026-10-29' }));
  storage.set('seven-traits-ai-v2', JSON.stringify({ report: mockAiReport(), answersKey: JSON.stringify(answers), model: 'deepseek-flash', generatedAt: '2026-10-30' }));
  assert.equal(createAiReportClient(() => answers).getReport(), undefined);
  assert.equal(storage.has('seven-traits-ai-v1.2'), false);
  assert.equal(storage.has('seven-traits-ai-v2'), false);
  assert.equal(storage.get(draftStorageKey), saved);
  assert.equal(store.read().draft.submitted, true);
  assert.equal(requests, 0);
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

test('incomplete answers never restore a forged report or start a paid request', async t => {
  const storage = setup(t, () => { throw new Error('must not request provider'); });
  const partial = Array(56).fill(null);
  storage.set('seven-traits-ai-v1.2', JSON.stringify({ answersKey: JSON.stringify(partial), report: mockAiReport(), model: 'test-model', generatedAt: '2026-10-29T12:00:00Z' }));
  const client = createAiReportClient(() => partial);
  assert.equal(client.getReport(), undefined);
  await assert.rejects(client.generate(), /完成全部题目/);
});
