import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiReportClient } from '../src/scripts/four-elements-ai.ts';
import { mockAiReport } from './fixtures/four-elements/ai-response.mjs';
import { validateAiReport } from '../src/lib/four-elements-ai.ts';
const answers = [...Array(36).fill(3), ...Array(12).fill('A')];
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
