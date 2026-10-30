import test from 'node:test';
import assert from 'node:assert/strict';
import { axisAngle, dimensions, isDraftAnswers, questions, reverseIds, scoreAnswers, selectPairs } from '../src/lib/seven-traits.ts';

test('V1.2 covers all 56 questions once with four items per dimension', () => {
  assert.equal(questions.length, 56);
  assert.deepEqual(questions.map((q) => q.id), Array.from({ length: 56 }, (_, i) => i + 1));
  assert.ok(dimensions.every((d) => d.ids.length === 4));
  assert.deepEqual(dimensions.flatMap((d) => [...d.ids]).sort((a, b) => a - b), questions.map((q) => q.id));
  assert.deepEqual(reverseIds, [39, 50]);
});

test('synthetic mixed answers reproduce all fourteen expected scores', () => {
  // Generated fixture; never use a participant's actual answers here.
  const answers = Array.from({ length: 56 }, (_, i) => (i * 7 + Math.floor(i / 5)) % 5 + 1);
  assert.deepEqual(scoreAnswers(answers).map((d) => d.score), [50.0, 56.3, 37.5, 43.8, 43.8, 31.3, 6.3, 68.8, 56.3, 56.3, 75.0, 43.8, 62.5, 50.0]);
});

test('reverse scoring, neutral answers, limits and half-up rounding', () => {
  assert.ok(scoreAnswers(Array(56).fill(3)).every((d) => d.score === 50));
  const low = Array(56).fill(1); low[38] = 5; low[49] = 5;
  assert.ok(scoreAnswers(low).every((d) => d.score === 0));
  const high = Array(56).fill(5); high[38] = 1; high[49] = 1;
  assert.ok(scoreAnswers(high).every((d) => d.score === 100));
  const half = Array(56).fill(3); half[0] = 4;
  assert.equal(scoreAnswers(half)[0].score, 56.3);
});

test('reject incomplete, sparse and invalid answers', () => {
  for (const value of [null, 0, 6, 2.5, '3', NaN]) {
    const answers = Array(56).fill(3); answers[0] = value;
    assert.throws(() => scoreAnswers(answers));
  }
  assert.throws(() => scoreAnswers(Array(55).fill(3)));
  assert.equal(isDraftAnswers(Array(56)), false);
  assert.equal(isDraftAnswers(Array(56).fill(null)), true);
});

test('all paired radar axes differ by 180 degrees with seven on each side', () => {
  for (let i = 0; i < 14; i += 2) {
    assert.ok(Math.abs((axisAngle(i + 1) - axisAngle(i) + 360) % 360 - 180) < 1e-10);
    assert.ok(axisAngle(i) > 180 && axisAngle(i) < 360);
    assert.ok(axisAngle(i + 1) > 0 && axisAngle(i + 1) < 180);
  }
});

test('all four-item answer combinations match exact integer half-up arithmetic', () => {
  for (const dimension of dimensions) {
    for (let pattern = 0; pattern < 625; pattern++) {
      const answers = Array(56).fill(3);
      let remaining = pattern;
      let adjustedSum = 0;
      for (const id of dimension.ids) {
        const raw = remaining % 5 + 1;
        remaining = Math.floor(remaining / 5);
        answers[id - 1] = raw;
        adjustedSum += reverseIds.includes(id) ? 6 - raw : raw;
      }
      const expectedTenths = Math.floor(((adjustedSum - 4) * 125 + 1) / 2);
      assert.equal(scoreAnswers(answers).find((d) => d.name === dimension.name).score, expectedTenths / 10);
    }
  }
});

test('report prioritizes jointly endorsed pairs, then genuine score gaps', () => {
  const result = scoreAnswers(Array(56).fill(3));
  result[0].score = 100; result[0].mean = 5;
  result[1].score = 93.8; result[1].mean = 4.75;
  result[2].score = 100; result[2].mean = 5;
  result[3].score = 0; result[3].mean = 1;
  result[4].score = 93.8; result[4].mean = 4.75;
  result[5].score = 81.3; result[5].mean = 4.25;
  const before = structuredClone(result);
  assert.deepEqual(selectPairs(result).map((pair) => pair.a.name), ['暴怒', '傲慢', '嫉妒', '懒惰']);
  assert.deepEqual(result, before);
});
