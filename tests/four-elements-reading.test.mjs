import assert from 'node:assert/strict';
import test from 'node:test';
import { readingGroups, readingPlans, readingPresentation, groupingPolicy } from '../src/lib/four-elements-reading.ts';
const names = ['wind', 'water', 'earth', 'fire'];
const result = values => ({ ranking: [...names], composite: Object.fromEntries(names.map((e, i) => [e, values[i]])) });
const sizes = values => readingGroups(result(values)).map(g => g.length);

test('whole-distribution grouping covers the accepted report structures', () => {
  for (const [values, expected] of [
    [[63.3, 63.3, 58.9, 56.7], [2, 2]], [[86.7, 63.3, 61.1, 55.6], [1, 2, 1]],
    [[90, 61, 60, 59], [1, 3]], [[70, 69, 68, 67], [4]],
    [[70, 66, 62, 58], [1, 1, 1, 1]], [[50, 50, 50, 50], [4]],
    [[20, 11, 10, 2], [1, 2, 1]], [[70, 70, 67, 67], [4]],
  ]) assert.deepEqual(sizes(values), expected, values.join(','));
});

test('the report example stays 2+2 under small score changes and uses full precision', () => {
  for (const delta of [-.1, 0, .1]) for (let i = 0; i < 4; i++) {
    const values = [63.3333, 63.3333, 58.8889, 56.6667]; values[i] += delta;
    assert.deepEqual(sizes(values), [2, 2]);
  }
  assert.deepEqual(sizes([70, 70, 66.9999, 66.9999]), [2, 2]); // Rounding first would erase the cost difference.
});

test('groups preserve coverage, ties, internal span and genuine boundaries across score distributions', () => {
  const values = [0, 2, 4, 6, 10, 50, 100];
  for (let a = 0; a < values.length; a++) for (let b = 0; b <= a; b++) for (let c = 0; c <= b; c++) for (let d = 0; d <= c; d++) {
    const scores = result([values[a], values[b], values[c], values[d]]), before = JSON.stringify(scores);
    const groups = readingGroups(scores), point = e => scores.composite[e];
    assert.deepEqual(groups.flat(), names);
    groups.forEach(g => assert.ok(point(g[0]) - point(g.at(-1)) <= groupingPolicy.maxSpan + groupingPolicy.epsilon));
    const internal = g => Math.max(0, ...g.slice(1).map((e, i) => point(g[i]) - point(e)));
    groups.slice(1).forEach((right, i) => assert.ok(point(groups[i].at(-1)) - point(right[0]) > Math.max(internal(groups[i]), internal(right))));
    assert.equal(JSON.stringify(scores), before);
    assert.deepEqual(readingGroups(scores), groups);
  }
});

test('equal scores and all-low scores never acquire a dominant tier from chapter planning', () => {
  const low = result([10, 10, 10, 10]);
  assert.deepEqual(readingGroups(low), [names]);
  assert.equal(readingPresentation(low).overallClose, true);
  assert.equal(readingPresentation(result([70, 66, 62, 58])).mode, 'individual');
  assert.equal(readingPresentation(result([70, 67, 64, 60])).overallClose, true);
  assert.equal(readingPresentation(result([70, 67, 64, 59.9999])).overallClose, false);
  assert.ok(readingPlans(result([86.7, 63.3, 61.1, 55.6])).every(p => p.layout === (p.elements.length === 1 ? 'features' : 'paired')));
});
