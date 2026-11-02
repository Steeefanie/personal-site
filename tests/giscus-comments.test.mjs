import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const component = readFileSync(new URL('../src/components/GiscusComments.astro', import.meta.url), 'utf8');
const source = stripTypeScriptTypes(component.split('<script>')[1].split('</script>')[0]
  .replace(/^import .*;\s*$/gm, '').replaceAll('import.meta.env.DEV', 'false'));

async function setup() {
  const events = new Map(), timers = new Map(), cleanups = [], observers = [];
  const node = () => ({ hidden: false, setAttribute(name) { if (name === 'hidden') this.hidden = true; }, removeAttribute(name) { if (name === 'hidden') this.hidden = false; } });
  const status = node(), error = node(); error.hidden = true;
  const mount = { append(script) { this.script = script; } };
  const root = { dataset: { giscusMode: 'article', giscusReady: 'true', themeLight: 'light' },
    querySelector(selector) { return selector.includes('status') ? status : selector.includes('error') ? error : selector.includes('mount') ? mount : this.frame; } };
  const window = { setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } };
  const document = { documentElement: { dataset: { language: 'zh-CN', theme: 'light' } },
    querySelectorAll: () => [root], createElement: () => ({ dataset: {}, addEventListener(type, callback) { this[type] = callback; } }) };
  vm.runInNewContext(source, { window, document, location: { hostname: 'example.com', pathname: '/' },
    onPageLoad: init => init({ onWindow: (type, callback) => events.set(type, callback), cleanup: fn => cleanups.push(fn) }),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    }, TextEncoder, URL, URLSearchParams });
  await new Promise(resolve => setImmediate(resolve));
  const state = { root, status, error, mount, timers,
    frame() { root.frame = { contentWindow: {} }; observers.filter(observer => observer.active).forEach(observer => observer.callback()); },
    message(data, origin = 'https://giscus.app', source = root.frame?.contentWindow) { events.get('message')({ origin, source, data: { giscus: data } }); },
    timeout() { [...timers.values()].forEach(fn => fn()); },
    cleanup() { cleanups.forEach(fn => fn()); } };
  return state;
}

test('a missing iframe times out visibly', async () => {
  const state = await setup();
  assert.equal(state.root.dataset.giscusState, 'loading');
  state.timeout();
  assert.equal(state.root.dataset.giscusState, 'error');
  assert.equal(state.error.hidden, false);
  assert.equal(state.status.hidden, true);
});

test('creating the iframe completes mounting without requiring a resize handshake', async () => {
  const state = await setup();
  state.message({ resizeHeight: 400 }, 'https://example.com');
  state.message({ resizeHeight: 400 }, 'https://giscus.app', {});
  state.message({ resizeHeight: -1 });
  assert.equal(state.root.dataset.giscusState, 'loading');
  state.frame();
  assert.equal(state.root.dataset.giscusState, 'ready');
  assert.equal(state.status.hidden, true);
  assert.equal(state.error.hidden, true);
  assert.equal(state.timers.size, 0);
});

test('an error followed by an error-page resize cannot hide the failure', async () => {
  const state = await setup(); state.frame();
  state.message({ error: 'API rate limit exceeded' });
  state.message({ resizeHeight: 100 });
  assert.equal(state.root.dataset.giscusState, 'error');
  assert.equal(state.error.hidden, false);
});

test('a slow frame can recover after the loading timeout', async () => {
  const state = await setup();
  state.timeout();
  assert.equal(state.root.dataset.giscusError, 'timeout');
  state.frame();
  assert.equal(state.root.dataset.giscusState, 'ready');
  assert.equal(state.root.dataset.giscusError, undefined);
  assert.equal(state.error.hidden, true);
});

test('a script load error is visible and page cleanup cancels the timeout', async () => {
  const state = await setup();
  state.mount.script.error();
  assert.equal(state.error.hidden, false);
  assert.equal(state.timers.size, 0);
  const pending = await setup();
  assert.equal(pending.timers.size, 1);
  pending.cleanup();
  assert.equal(pending.timers.size, 0);
});
