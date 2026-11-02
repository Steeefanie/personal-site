import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/scripts/selection-touch.ts', import.meta.url), 'utf8'));
const { installTouchSlider } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const setup = (vertical = false) => {
  const group = new EventTarget();
  const classes = new Set(), captured = new Set(), previews = [], commits = [];
  let resets = 0, clicks = 0;
  group.classList = { add: c => classes.add(c), remove: c => classes.delete(c) };
  group.hasPointerCapture = id => captured.has(id);
  group.setPointerCapture = id => captured.add(id);
  group.releasePointerCapture = id => captured.delete(id);
  group.scrollWidth = group.clientWidth = 300;
  group.getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, bottom: 150 });
  const options = Array.from({ length: 3 }, (_, index) => ({
    getBoundingClientRect: () => vertical
      ? { left: 0, right: 100, top: index * 50, bottom: (index + 1) * 50 }
      : { left: index * 100, right: (index + 1) * 100, top: 0, bottom: 50 },
    click: () => { commits.push(index); group.dispatchEvent(new Event('click', { cancelable: true })); },
  }));
  installTouchSlider(group, { vertical, options: () => options, selected: () => options[0], preview: option => previews.push(options.indexOf(option)), reset: () => resets++ });
  group.addEventListener('click', () => clicks++);
  const pointer = (type, x = 20, y = 20, pointerType = 'touch') => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerType, pointerId: 1, isPrimary: true, clientX: x, clientY: y });
    group.dispatchEvent(event);
    return event;
  };
  return { group, classes, captured, previews, commits, pointer, resets: () => resets, clicks: () => clicks };
};

test('drag previews without committing, commits once on release and suppresses the following native click', () => {
  const f = setup();
  f.pointer('pointerdown');
  f.pointer('pointermove', 150);
  assert.deepEqual(f.previews, [1]);
  assert.deepEqual(f.commits, []);
  assert.ok(f.classes.has('is-slider-dragging'));
  f.pointer('pointerup', 250);
  assert.deepEqual(f.commits, [2]);
  assert.equal(f.clicks(), 1);
  const native = new Event('click', { cancelable: true });
  f.group.dispatchEvent(native);
  assert.equal(native.defaultPrevented, true);
  assert.equal(f.clicks(), 1);
  assert.equal(f.captured.size, 0);
});

test('scroll intent, cancellation and release outside the options never activate a destination', () => {
  for (const mode of ['scroll', 'cancel', 'outside']) {
    const f = setup();
    f.pointer('pointerdown');
    if (mode === 'scroll') f.pointer('pointermove', 22, 60);
    else {
      f.pointer('pointermove', 150);
      f.pointer(mode === 'cancel' ? 'pointercancel' : 'pointerup', 400);
    }
    assert.deepEqual(f.commits, []);
    assert.ok(f.resets() > 0);
    assert.equal(f.captured.size, 0);
  }
});

test('vertical menus drag from the selected thumb while other rows remain scrollable', () => {
  const f = setup(true);
  f.pointer('pointerdown', 20, 70);
  f.pointer('pointermove', 20, 120);
  assert.deepEqual(f.previews, []);
  f.pointer('pointerdown', 20, 20);
  f.pointer('pointermove', 20, 120);
  assert.deepEqual(f.previews, [2]);
  f.pointer('pointerup', 20, 120);
  assert.deepEqual(f.commits, [2]);
});

test('ordinary taps and mouse movement retain their native click behavior', () => {
  const f = setup();
  f.pointer('pointerdown');
  f.pointer('pointermove', 23, 22);
  f.pointer('pointerup', 23, 22);
  f.pointer('pointerdown', 20, 20, 'mouse');
  f.pointer('pointermove', 150, 20, 'mouse');
  assert.deepEqual(f.commits, []);
  const click = new Event('click', { cancelable: true });
  f.group.dispatchEvent(click);
  assert.equal(click.defaultPrevented, false);
});
