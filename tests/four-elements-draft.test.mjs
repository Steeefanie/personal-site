import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftStore, draftStorageKey } from '../src/lib/four-elements-draft.ts';

const draft = () => ({ version: '1.0', answers: Array(48).fill(null), page: 0, completed: false, submitted: false });
function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test('round-trips partial answers and page, then clears only this measurement', () => {
  const memory = memoryStorage();
  const store = createDraftStore(() => memory);
  assert.equal(store.read().kind, 'empty');
  memory.setItem('theme', 'dark');
  const partial = draft();
  partial.answers[0] = 5;
  partial.answers[36] = 'B';
  partial.page = 6;
  assert.equal(store.save(partial), true);
  assert.deepEqual(store.read(), { kind: 'restored', draft: partial });
  assert.equal(store.clear(), true);
  assert.equal(store.read().kind, 'empty');
  assert.equal(memory.getItem('theme'), 'dark');
});

test('rejects damaged JSON, unknown versions, missing and invalid answers without erasing data', () => {
  const memory = memoryStorage();
  const store = createDraftStore(() => memory);
  for (const raw of ['', '{', 'null', '5', '[]', '{}', JSON.stringify({ ...draft(), version: '2.0' }), JSON.stringify({ ...draft(), answers: Array(48).fill('5') })]) {
    memory.setItem(draftStorageKey, raw);
    assert.equal(store.read().kind, 'invalid');
    assert.equal(memory.getItem(draftStorageKey), raw);
  }
});

test('resets out-of-range page indexes and ignores a forged completion flag', () => {
  const memory = memoryStorage();
  const store = createDraftStore(() => memory);
  for (const page of [-1, 8, 2.5, '3', null]) {
    memory.setItem(draftStorageKey, JSON.stringify({ ...draft(), page, completed: true }));
    const restored = store.read();
    assert.equal(restored.kind, 'restored');
    assert.equal(restored.draft.page, 0);
    assert.equal(restored.draft.completed, false);
  }
});

test('restores a finished report only with all 48 valid answers', () => {
  const memory = memoryStorage();
  const store = createDraftStore(() => memory);
  const finished = { ...draft(), answers: [...Array(36).fill(3), ...Array(12).fill('A')], page: 7, completed: true };
  store.save(finished);
  assert.deepEqual(store.read(), { kind: 'restored', draft: finished });
});

test('keeps a report available after editing a full answer sheet on any page', () => {
  const memory = memoryStorage();
  const store = createDraftStore(() => memory);
  for (const page of [0, 3, 6, 7]) {
    const editing = { ...draft(), answers: [...Array(36).fill(4), ...Array(12).fill('B')], page, completed: false };
    store.save(editing);
    assert.deepEqual(store.read(), { kind: 'restored', draft: { ...editing, completed: true } });
  }
});

test('handles storage access denial, including a throwing storage getter', () => {
  const denied = () => { throw new Error('SecurityError'); };
  for (const store of [createDraftStore(denied), createDraftStore(() => ({ getItem: denied, setItem: denied, removeItem: denied }))]) {
    assert.equal(store.read().kind, 'unavailable');
    assert.equal(store.save(draft()), false);
    assert.equal(store.clear(), false);
  }
});

test('reports write quota and delete failures without claiming success or losing old data', () => {
  const memory = memoryStorage();
  memory.setItem(draftStorageKey, JSON.stringify(draft()));
  const failing = createDraftStore(() => ({ ...memory,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  }));
  assert.equal(failing.save({ ...draft(), page: 2 }), false);
  assert.equal(failing.clear(), false);
  assert.deepEqual(failing.read(), { kind: 'restored', draft: draft() });
});


test('submission locks survive restoration only with complete answers; legacy drafts remain unsubmitted', () => {
  const memory = memoryStorage(), store = createDraftStore(() => memory);
  const complete = { ...draft(), answers: [...Array(36).fill(3), ...Array(12).fill('A')], completed: true, submitted: true };
  store.save(complete);
  assert.equal(store.read().draft.submitted, true);
  store.save({ ...draft(), submitted: true });
  assert.equal(store.read().draft.submitted, false);
  const { submitted, ...legacy } = complete;
  memory.setItem(draftStorageKey, JSON.stringify(legacy));
  assert.equal(store.read().draft.submitted, false);
});
