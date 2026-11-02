import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/input-modality.ts', import.meta.url), 'utf8')).replace('export {};', '');
const setup = (touch = false) => {
  const document = new EventTarget();
  document.documentElement = { dataset: {} };
  vm.runInNewContext(source, { document, matchMedia: () => ({ matches: touch }) });
  const pointer = (type, pointerType) => {
    const event = new Event(type);
    event.pointerType = pointerType;
    document.dispatchEvent(event);
  };
  return { document, pointer };
};

test('touch disables sticky hover without clearing keyboard focus or selected controls', () => {
  const { document, pointer } = setup();
  assert.equal(document.documentElement.dataset.inputModality, 'pointer');
  pointer('pointerdown', 'touch');
  pointer('pointermove', 'touch');
  assert.equal(document.documentElement.dataset.inputModality, 'touch');
  // No blur or mutation of controls is available in this fixture.
  pointer('pointermove', 'mouse');
  assert.equal(document.documentElement.dataset.inputModality, 'pointer');
});

test('touch-first devices and local navigation retain the touch modality', () => {
  const { document } = setup(true);
  assert.equal(document.documentElement.dataset.inputModality, 'touch');
  const event = new Event('astro:before-swap');
  event.newDocument = { documentElement: { dataset: {} } };
  document.dispatchEvent(event);
  assert.equal(event.newDocument.documentElement.dataset.inputModality, 'touch');
});
