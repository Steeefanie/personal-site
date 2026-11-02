import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/glass.ts', import.meta.url), 'utf8'))
  .replace(/^import \{[^}]+\} from [^;]+;\s*/gm, '');
const policySource = stripTypeScriptTypes(readFileSync(new URL('../src/lib/glass-policy.ts', import.meta.url), 'utf8'));
const { glassBlur, glassEngine, hasStaticGlassBackground } = await import(`data:text/javascript;base64,${Buffer.from(policySource).toString('base64')}`);

async function setup({ userAgent = 'Chrome/145.0', solid = false, supported = true, failLoad = false, theme = 'light' } = {}) {
  const events = new Map();
  const timers = new Map();
  const calls = [];
  const active = new Set();
  const attributes = new Set();
  const classes = new Set();
  const header = { classList: { contains: name => classes.has(name) } };
  const chrome = { panelName: 'search', getAttribute: name => attributes.has(name) ? chrome.panelName : null, querySelector: () => header };
  const contents = { dataset: { open: 'false', mode: 'overlay' } };
  const surfaces = ['navigation', 'contents', 'ignored'].map(glass => ({ dataset: { glass }, isConnected: true, classList: { contains: () => false } }));
  const media = [solid, false].map(matches => ({ matches, addEventListener(_type, callback) { this.change = callback; } }));
  const api = {
    DEFAULTS: { shade: 0.46, edgeW: 8, rim: 1.76, edge: 0.32, sat: 0.86 },
    setOpts(options) { calls.push(['setOpts', options]); return Promise.resolve(); },
    supported: () => supported,
    attach(element, options) { calls.push(['attach', element, options]); active.add(element); },
    detach(element) { calls.push(['detach', element]); active.delete(element); },
    refresh(element) { calls.push(['refresh', element]); },
  };
  const document = {
    documentElement: { dataset: { theme } },
    hidden: false,
    querySelectorAll: () => surfaces,
    querySelector: selector => selector.includes('top-chrome') ? chrome : contents,
    createElement: () => ({}),
    head: { append(script) { calls.push(['load', script.src]); queueMicrotask(() => failLoad ? script.onerror() : script.onload()); } },
    addEventListener: (type, callback) => events.set(type, callback),
  };
  let mutation;
  let nextTimer = 0;
  class Observer {
    constructor(callback) { this.callback = callback; if (!mutation) mutation = callback; }
    observe() {}
    unobserve() {}
    disconnect() { calls.push(['disconnect']); }
  }
  const window = { Hyalite: api, setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(source, { window, document, navigator: { userAgent },
    glassBlur, glassEngine, hasStaticGlassBackground,
    MutationObserver: Observer, ResizeObserver: Observer,
    matchMedia: query => query.includes('transparency') ? media[0] : media[1],
    addEventListener: (type, callback) => events.set(type, callback),
  });
  await new Promise(resolve => setImmediate(resolve));
  return { calls, active, attributes, chrome, classes, contents, surfaces, media, document, events,
    mutate: () => mutation?.(),
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
  };
}

test('unsupported engines and a failed optional load retain CSS without attaching filters', async () => {
  for (const options of [{ userAgent: 'Version/18 Safari/605.1' }, { supported: false }, { failLoad: true }]) {
    const state = await setup(options);
    assert.equal(state.active.size, 0);
    assert.equal(state.calls.some(([call]) => call === 'attach'), false);
  }
});

test('known material surfaces attach and hidden or changing controls detach immediately', async () => {
  const state = await setup();
  assert.deepEqual([...state.active], [state.surfaces[0]]);
  state.contents.dataset.open = 'true'; state.mutate(); state.flush();
  assert.equal(state.active.size, 2);
  assert.equal(state.surfaces[0].dataset.glassActive, 'true');
  assert.equal(state.surfaces[1].dataset.glassActive, 'true');
  assert.equal(state.active.has(state.surfaces[2]), false);
  state.attributes.add('data-panel-open'); state.mutate();
  assert.equal(state.active.has(state.surfaces[0]), false);
  state.contents.dataset.resizing = 'true'; state.mutate();
  assert.equal(state.active.size, 0);
  assert.equal(state.surfaces.some(element => element.dataset.glassActive), false);
  state.attributes.clear(); state.contents.dataset.resizing = 'false'; state.mutate(); state.flush();
  assert.equal(state.active.size, 2);
});

test('shared control backgrounds use the same material and are released on route changes', async () => {
  const state = await setup();
  const controls = [0, 1].map(() => ({ dataset: { glass: 'control' }, isConnected: true }));
  state.surfaces.push(...controls);
  state.events.get('astro:page-load')(); state.flush();
  assert.equal(state.active.size, 3);
  const navigationOptions = state.calls.find(([call]) => call === 'attach')[2];
  for (const control of controls) {
    const options = state.calls.find(([call, element]) => call === 'attach' && element === control)[2];
    assert.deepEqual(JSON.parse(JSON.stringify(options)), JSON.parse(JSON.stringify(navigationOptions)));
  }
  state.events.get('astro:before-swap')();
  assert.deepEqual([...state.active], [state.surfaces[0]]);
});

test('language and navigation menus preserve the existing glass while search releases it', async () => {
  const state = await setup();
  for (const panel of ['language', 'navigation']) {
    state.chrome.panelName = panel;
    state.attributes.add('data-panel-open'); state.mutate(); state.flush();
    assert.equal(state.active.has(state.surfaces[0]), true);
    assert.equal(state.calls.filter(([call]) => call === 'attach').length, 1);
    assert.equal(state.calls.some(([call]) => call === 'detach'), false);
  }
  state.chrome.panelName = 'search'; state.mutate();
  assert.equal(state.active.size, 0);
});

test('opening menus attaches immediately without waiting for the deferred refresh', async () => {
  const state = await setup();
  let visible = false;
  const menu = { dataset: { glass: 'menu' }, isConnected: true, getClientRects: () => visible ? [{}] : [] };
  state.surfaces.push(menu);
  state.events.get('astro:page-load')(); state.flush();
  assert.equal(state.active.has(menu), false);
  const refreshes = state.calls.filter(([call]) => call === 'refresh').length;
  visible = true; state.mutate();
  assert.equal(state.active.has(menu), true);
  assert.equal(state.calls.find(([call, element]) => call === 'attach' && element === menu)[2].materialize, 0);
  state.mutate();
  assert.equal(state.calls.filter(([call, element]) => call === 'attach' && element === menu).length, 1);
  assert.equal(state.calls.filter(([call]) => call === 'refresh').length, refreshes);
  state.flush();
  assert.equal(state.calls.filter(([call, element]) => call === 'refresh' && element === menu).length, 1);
  visible = false; state.mutate();
  assert.equal(state.active.has(menu), false);
});

test('confirmation dialogs attach the shared optics on open and release on close', async () => {
  const state = await setup();
  let open = false;
  const dialog = {
    dataset: { glass: 'dialog' }, isConnected: true,
    hasAttribute: name => name === 'open' && open,
    getClientRects: () => open ? [{}] : [],
  };
  state.surfaces.push(dialog);
  state.events.get('astro:page-load')(); state.flush();
  assert.equal(state.active.has(dialog), false);
  open = true; state.mutate();
  assert.equal(state.active.has(dialog), true);
  const options = state.calls.find(([call, element]) => call === 'attach' && element === dialog)[2];
  assert.equal(options.blur, 3);
  assert.equal(options.edgeW, 2);
  open = false; state.mutate();
  assert.equal(state.active.has(dialog), false);
  assert.equal(dialog.dataset.glassActive, undefined);
});

test('a dialog background and close lens follow their owning dialog lifecycle', async () => {
  const state = await setup();
  let open = false;
  let closing = false;
  const owner = {};
  const surface = glass => ({
    dataset: { glass }, isConnected: true,
    getClientRects: () => open ? [{}] : [],
    closest: selector => selector === 'dialog' || (selector === 'dialog[open]' && open)
      || (selector === '.is-closing' && closing) ? owner : null,
  });
  const background = surface('dialog');
  const close = surface('control');
  state.surfaces.push(background, close);
  state.events.get('astro:page-load')(); state.flush();
  assert.equal(state.active.has(background), false);
  assert.equal(state.active.has(close), false);
  open = true; state.mutate();
  assert.equal(state.active.has(background), true);
  assert.equal(state.active.has(close), true);
  assert.equal(state.calls.find(([call, element]) => call === 'attach' && element === background)[2].blur, 3);
  assert.equal(state.calls.find(([call, element]) => call === 'attach' && element === close)[2].blur, 2);
  const refreshes = () => state.calls.filter(([call, element]) => call === 'refresh' && [background, close].includes(element)).length;
  const beforeClosing = refreshes();
  closing = true; state.mutate(); state.flush();
  assert.equal(refreshes(), beforeClosing);
  open = false; state.mutate();
  assert.equal(state.active.has(background), false);
  assert.equal(state.active.has(close), false);
});

test('search attaches immediately on opening and releases on closing', async () => {
  const state = await setup();
  const search = { dataset: { glass: 'search' }, isConnected: true, hidden: true,
    getClientRects() { return this.hidden ? [] : [{}]; } };
  state.surfaces.push(search);
  state.events.get('astro:page-load')(); state.flush();
  assert.equal(state.active.has(search), false);
  search.hidden = false;
  state.attributes.add('data-panel-open'); state.mutate();
  assert.equal(state.active.has(search), true);
  assert.equal(state.active.has(state.surfaces[0]), false);
  assert.equal(state.calls.find(([call, element]) => call === 'attach' && element === search)[2].blur, 3);
  search.classList = { contains: name => name === 'is-closing' };
  const refreshes = state.calls.filter(([call, element]) => call === 'refresh' && element === search).length;
  state.mutate(); state.flush();
  assert.equal(state.active.has(search), true);
  assert.equal(state.calls.filter(([call, element]) => call === 'refresh' && element === search).length, refreshes);
  search.hidden = true; state.attributes.clear(); state.mutate(); state.flush();
  assert.equal(state.active.has(search), false);
  assert.equal(state.active.has(state.surfaces[0]), true);
});

test('light surfaces adapt edge lighting without overriding refraction geometry', async () => {
  const state = await setup();
  state.contents.dataset.open = 'true'; state.mutate(); state.flush();
  for (const [, element, options] of state.calls.filter(([call]) => call === 'attach')) {
    assert.deepEqual(Object.keys(options).sort(), ['blur', 'edge', 'edgeW', 'materialize', 'rim', 'sat', 'shade']);
    assert.equal(options.blur, element.dataset.glass === 'navigation' ? 2 : 3);
    assert.equal(options.materialize, 0);
    assert.equal(options.shade, 0.18);
    assert.equal(options.edgeW, 2);
    assert.equal(options.edge, 0.32);
    assert.equal(options.rim, 1.76);
    assert.equal(options.sat, 0.86);
  }
});

test('themes share refraction and lighting footprint while adapting reflection brightness', async () => {
  const light = await setup({ theme: 'light' });
  const dark = await setup({ theme: 'dark' });
  const options = state => state.calls.find(([call]) => call === 'attach')[2];
  const { edge: lightEdge, rim: lightRim, sat: lightSat, ...lightOptics } = options(light);
  const { edge: darkEdge, rim: darkRim, sat: darkSat, ...darkOptics } = options(dark);
  assert.deepEqual(JSON.parse(JSON.stringify(lightOptics)), JSON.parse(JSON.stringify(darkOptics)));
  assert.equal(lightEdge, 0.32);
  assert.equal(darkEdge, 0.03);
  assert.equal(lightRim, 1.76);
  assert.equal(darkRim, 0.35);
  assert.equal(lightSat, 0.86);
  assert.equal(darkSat, 1);
  dark.document.documentElement.dataset.theme = 'light';
  dark.events.get('site:theme-change')();
  const update = dark.calls.find(([call]) => call === 'setOpts')[1];
  assert.deepEqual(Object.keys(update).sort(), ['edge', 'rim', 'sat']);
  assert.equal(update.edge, 0.32);
  assert.equal(update.rim, 1.76);
  assert.equal(update.sat, 0.86);
  assert.equal(dark.calls.filter(([call]) => call === 'attach').length, 1);
  assert.equal(dark.calls.some(([call]) => call === 'detach'), false);
});
test('transparency preferences disable filters and can enable them without reloading the page', async () => {
  const state = await setup({ solid: true });
  assert.equal(state.calls.length, 0);
  state.media[0].matches = false; state.media[0].change();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.active.size, 1);
  state.media[0].matches = true; state.media[0].change();
  assert.equal(state.active.size, 0);
});

test('page hide releases filters and a back-forward cache restore reinitializes them', async () => {
  const state = await setup();
  state.contents.dataset.open = 'true'; state.mutate(); state.flush();
  state.events.get('pagehide')();
  assert.equal(state.active.size, 0);
  state.events.get('pageshow')({ persisted: true });
  assert.equal(state.active.size, 2);
  state.document.hidden = true; state.events.get('visibilitychange')();
  assert.equal(state.active.size, 0);
});

test('reduced motion removes materialization and resize events coalesce', async () => {
  const state = await setup({ solid: true });
  state.media[1].matches = true;
  state.media[0].matches = false; state.media[0].change();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.calls.find(([call]) => call === 'attach')[2].materialize, 0);
  const before = state.calls.filter(([call]) => call === 'refresh').length;
  for (let i = 0; i < 20; i++) state.mutate();
  state.flush();
  assert.equal(state.calls.filter(([call]) => call === 'refresh').length - before, 1);
});

test('local page swaps retain navigation enhancement and release page-owned contents', async () => {
  const state = await setup();
  state.contents.dataset.open = 'true'; state.mutate(); state.flush();
  state.events.get('astro:before-swap')();
  assert.deepEqual([...state.active], [state.surfaces[0]]);
  state.events.get('astro:page-load')(); state.flush();
  assert.equal(state.active.size, 2);
  assert.equal(state.calls.filter(([call, element]) => call === 'attach' && element === state.surfaces[0]).length, 1);
});

test('wide and narrow contents share the menu material and release while resizing', async () => {
  const state = await setup();
  const menu = { dataset: { glass: 'menu' }, isConnected: true };
  state.surfaces.push(menu);
  state.contents.dataset.open = 'true';
  state.events.get('astro:page-load')(); state.flush();
  for (const mode of ['dock', 'overlay']) {
    state.contents.dataset.mode = mode;
    state.mutate(); state.flush();
    assert.equal(state.active.has(state.surfaces[1]), true);
    const options = element => state.calls.find(([call, target]) => call === 'attach' && target === element)[2];
    assert.deepEqual(JSON.parse(JSON.stringify(options(state.surfaces[1]))), JSON.parse(JSON.stringify(options(menu))));
  }
  state.contents.dataset.resizing = 'true'; state.mutate();
  assert.equal(state.active.has(state.surfaces[1]), false);
  assert.equal(state.active.has(menu), true);
  state.contents.dataset.resizing = 'false'; state.mutate(); state.flush();
  assert.equal(state.active.has(state.surfaces[1]), true);
  state.contents.dataset.open = 'false'; state.mutate();
  assert.equal(state.active.has(state.surfaces[1]), false);
});
