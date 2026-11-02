import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/page-lifecycle.ts', import.meta.url), 'utf8'))
  .replace('export function onPageLoad', 'function onPageLoad');
const setup = () => {
  const document = new EventTarget();
  const window = new EventTarget();
  const initialize = vm.runInNewContext(`${source}; onPageLoad`, {
    document, window, AbortController, Event, PageTransitionEvent: Event, queueMicrotask,
  });
  const send = (name) => document.dispatchEvent(new Event(name));
  return { document, window, initialize, send };
};

test('route changes clean old global handlers and initialize the next page once', () => {
  const state = setup();
  let initialized = 0, cleaned = 0, clicks = 0;
  state.initialize((scope) => {
    initialized++;
    scope.onWindow('click', () => clicks++);
    scope.cleanup(() => cleaned++);
  });
  for (let index = 0; index < 4; index++) {
    state.send('astro:page-load');
    state.window.dispatchEvent(new Event('click'));
    state.send('astro:before-swap');
    state.window.dispatchEvent(new Event('click'));
  }
  assert.equal(initialized, 4);
  assert.equal(cleaned, 4);
  assert.equal(clicks, 4);
});

test('page teardown invokes pagehide and request cleanup without another full document load', () => {
  const state = setup();
  let hidden = 0, unloaded = 0;
  state.initialize((scope) => {
    scope.onWindow('pagehide', () => hidden++);
    scope.onWindow('beforeunload', () => unloaded++);
  });
  state.send('astro:page-load');
  state.send('astro:before-swap');
  state.send('astro:before-swap');
  assert.equal(hidden, 1);
  assert.equal(unloaded, 1);
});

test('new page receives restoration callback while disposed pages do not', async () => {
  const state = setup();
  let restored = 0;
  state.initialize((scope) => scope.onWindow('pageshow', () => restored++));
  state.send('astro:page-load');
  state.send('astro:before-swap');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restored, 0);
  state.send('astro:page-load');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restored, 1);
});
