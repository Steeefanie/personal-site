import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/fuse-bead-generator.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, ''));

async function setup(fetchResult, { decodeFails = false } = {}) {
  class Element {
    hidden = true;
    disabled = false;
    dataset = {};
    textContent = '';
    value = '';
    listeners = new Map();
    attributes = new Map();
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    removeAttribute(name) { this.attributes.delete(name); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    fire(type) { return this.listeners.get(type)?.({ preventDefault() {}, target: this }); }
  }
  const selectors = ['generator-form', 'file-input', 'upload-zone', 'file-summary', 'file-name', 'file-meta',
    'file-remove', 'size-input', 'size-estimate', 'generate-button', 'button-label', 'form-message',
    'preview-empty', 'preview-image', 'preview-loading', 'preview-title', 'result-meta', 'result-size',
    'result-mode', 'result-count', 'download-button', 'upload-message'];
  const elements = Object.fromEntries(selectors.map(name => [name, new Element()]));
  const side = new Element(); side.value = 'height';
  const mode = new Element(); mode.value = 'cms';
  elements['size-input'].value = '50';
  elements['generator-form'].querySelector = selector => selector.includes('fixed_side') ? side : mode;
  elements['generator-form'].querySelectorAll = () => [side, mode];
  const file = new File(['test image'], 'transparent.png', { type: 'image/png' });
  elements['file-input'].files = [file];
  const revoked = [];
  let nextUrl = 0;
  class Probe {
    naturalWidth = 2048;
    naturalHeight = 2048;
    set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); }
    decode() { return decodeFails ? Promise.reject(new Error('Cannot decode result')) : Promise.resolve(); }
  }
  vm.runInNewContext(source, {
    document: {
      documentElement: { dataset: { language: 'zh-CN' } },
      querySelector: selector => elements[selector.slice(6, -1)],
    },
    onPageLoad: initialize => initialize({ onWindow() {} }),
    isHeifFile: () => false,
    visibleContentSize: () => ({ width: 1600, height: 1600 }),
    Image: Probe, AbortController, FormData, File, Error, Date, queueMicrotask,
    URL: { createObjectURL: () => `blob:test-${++nextUrl}`, revokeObjectURL: url => revoked.push(url) },
    fetch: async () => typeof fetchResult === 'function' ? fetchResult() : fetchResult,
    console: { error() {} },
  });
  elements['file-input'].fire('change');
  await new Promise(resolve => setImmediate(resolve));
  return { elements, side, mode, revoked, submit: () => elements['generator-form'].fire('submit') };
}

test('server failures remain visible after loading ends, and retry restores the button', async () => {
  const state = await setup(new Response(JSON.stringify({ detail: 'Generation failed' }), { status: 503 }));
  await state.submit();
  assert.equal(state.elements['preview-loading'].hidden, true);
  assert.equal(state.elements['generate-button'].disabled, false);
  assert.equal(state.elements['button-label'].textContent, '生成图纸');
  assert.equal(state.elements['form-message'].hidden, false);
  assert.equal(state.elements['form-message'].textContent, '服务暂时不可用，请稍后重试。');
  assert.equal(state.elements['download-button'].hidden, true);
  state.side.fire('change');
  assert.equal(state.elements['form-message'].hidden, true);
});

test('network failures are reported instead of silently returning to source preview', async () => {
  const state = await setup(() => { throw new Error('Connection refused'); });
  await state.submit();
  assert.equal(state.elements['form-message'].hidden, false);
  assert.equal(state.elements['form-message'].textContent, '服务暂时不可用，请稍后重试。');
  assert.equal(state.elements['preview-loading'].hidden, true);
});

test('an unreadable successful response cannot be exposed as a downloadable pattern', async () => {
  const state = await setup(new Response('<html>Error</html>'), { decodeFails: true });
  await state.submit();
  assert.equal(state.elements['form-message'].hidden, false);
  assert.equal(state.elements['form-message'].textContent, '生成失败，请稍后重试。');
  assert.equal(state.elements['download-button'].hidden, true);
  assert.deepEqual(state.revoked, ['blob:test-2']);
});

test('a decoded result keeps the download and pattern metadata visible', async () => {
  const state = await setup(new Response(new Blob(['pattern']), { headers: { 'X-Colour-Count': '3' } }));
  await state.submit();
  assert.equal(state.elements['form-message'].hidden, true);
  assert.equal(state.elements['download-button'].hidden, false);
  assert.equal(state.elements['result-meta'].hidden, false);
  assert.equal(state.elements['result-count'].textContent, '3');
});
