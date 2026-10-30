import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { elements, questions, scoreAnswers, isDraftAnswers, summarizeResult, interpretElement } from '../src/lib/four-elements.ts';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/four-elements/${name}.json`, import.meta.url), 'utf8'));
const input = fixture('input');
const sample = [...input.likert, ...input.forced];

test('matches the original Python scorer regression fixture in full', () => {
  assert.deepEqual(scoreAnswers(sample), fixture('expected'));
});

test('question bank contains 9 Likert items and 6 pairwise appearances per element', () => {
  assert.equal(questions.length, 48);
  assert.deepEqual(questions.map((q) => q.id), Array.from({ length: 48 }, (_, i) => i + 1));
  for (const element of elements) {
    assert.equal(questions.filter((q) => q.type === 'likert' && q.element === element).length, 9);
    assert.equal(questions.filter((q) => q.type === 'forced_choice' && Object.values(q.options).some((option) => option.element === element)).length, 6);
  }
});

test('rejects incomplete, sparse, out-of-range and wrong-type answers', () => {
  for (const invalid of [sample.slice(1), Array(48), [...Array(36).fill(true), ...input.forced], [...Array(36).fill(0), ...input.forced], [...Array(36).fill(6), ...input.forced], [...Array(36).fill(2.5), ...input.forced], [...input.likert, ...Array(12).fill('C')]]) {
    assert.throws(() => scoreAnswers(invalid));
    assert.equal(isDraftAnswers(invalid), false);
  }
  assert.equal(isDraftAnswers(Array(48).fill(null)), true);
  assert.throws(() => scoreAnswers(Array(48).fill(null)));
});

test('all minimum and maximum Likert answers produce finite bounded scores', () => {
  for (const value of [1, 5]) {
    for (let mask = 0; mask < 4096; mask++) {
      const answers = [...Array(36).fill(value), ...Array.from({ length: 12 }, (_, i) => mask & (1 << i) ? 'A' : 'B')];
      const result = scoreAnswers(answers);
      assert.equal(elements.reduce((sum, e) => sum + result.forced[e].wins, 0), 12);
      for (const element of elements) {
        assert.ok(Number.isFinite(result.relative_share[element]));
        assert.ok(result.composite[element] >= 0 && result.composite[element] <= 100);
      }
      assert.ok(Math.abs(Object.values(result.relative_share).reduce((a, b) => a + b) - 100) <= 0.021);
    }
  }
});

test('four-way ties are described as close without arbitrarily selecting a dominant element', () => {
  const balancedForced = ['A', 'A', 'B', 'A', 'B', 'A', 'B', 'B', 'A', 'B', 'A', 'B'];
  const result = scoreAnswers([...Array(36).fill(3), ...balancedForced]);
  assert.deepEqual(Object.values(result.forced).map((v) => v.wins), [3, 3, 3, 3]);
  assert.equal(summarizeResult(result).heading, '四项倾向接近');
  assert.equal(summarizeResult(result).leaders.length, 4);
  assert.ok(summarizeResult(result).lowest.includes('不足 5 分'));
});

test('interpretation follows item differences and handles identical answers', () => {
  const result = scoreAnswers(sample);
  const earth = interpretElement(result, 'earth');
  assert.ok(earth.descriptions.some((text) => text.includes('履约与方法复用') && text.includes('稳定偏好与长期维持')));
  assert.equal(earth.spread, 4);
  const flat = interpretElement(scoreAnswers([...Array(36).fill(1), ...input.forced]), 'earth');
  assert.equal(flat.spread, 0);
  assert.ok(flat.descriptions.some((text) => text.includes('完全相同')));
});
