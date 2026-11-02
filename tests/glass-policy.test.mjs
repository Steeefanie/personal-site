import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(readFileSync(new URL('../src/lib/glass-policy.ts', import.meta.url), 'utf8'));
const { glassEngine, glassBlur, hasStaticGlassBackground } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('Chromium, Safari and iOS browsers choose their actual engine family', () => {
  assert.equal(glassEngine('AppleWebKit/537.36 Chrome/145.0 Safari/537.36'), 'chromium');
  assert.equal(glassEngine('AppleWebKit/537.36 Chrome/145.0 Edg/145.0'), 'chromium');
  for (const browser of ['Version/27.2 Safari/605.1.15', 'CriOS/145.0', 'FxiOS/145.0', 'EdgiOS/145.0'])
    assert.equal(glassEngine(`iPhone AppleWebKit/605.1.15 ${browser}`), 'webkit');
  assert.equal(glassEngine('Gecko/20100101 Firefox/145.0'), 'css');
});
test('icons keep 2px frost and secondary windows use 3px', () => {
  for (const kind of ['navigation', 'control']) assert.equal(glassBlur(kind), 2);
  assert.equal(glassBlur('contents', true), 2);
  for (const kind of ['search', 'menu', 'dialog', 'contents']) assert.equal(glassBlur(kind), 3);
});

test('static surfaces and docked TOC icons skip both enhancement engines', () => {
  const surface = (name, mode, parentStatic = false) => ({
    classList: { contains: (candidate) => candidate === name },
    closest: (selector) => selector === '.glass-surface--static' ? (parentStatic ? {} : null)
      : (mode ? { getAttribute: () => mode } : null),
  });
  assert.equal(hasStaticGlassBackground(surface('glass-surface--static')), true);
  assert.equal(hasStaticGlassBackground(surface('', undefined, true)), true);
  assert.equal(hasStaticGlassBackground(surface('article-toc-toggle-surface', 'dock')), true);
  assert.equal(hasStaticGlassBackground(surface('article-toc-toggle-surface', 'overlay')), false);
  assert.equal(hasStaticGlassBackground(surface('top-chrome-surface')), false);
});
