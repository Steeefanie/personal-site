import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mockAiReport, syntheticPairedAnswers } from './fixtures/four-elements/ai-response.mjs';
import { questions, scoreAnswers } from '../src/lib/four-elements.ts';
import { buildNarrativeReport } from '../src/lib/four-elements-report.ts';

const sample = JSON.parse(readFileSync(new URL('./fixtures/four-elements/input.json', import.meta.url), 'utf8'));
const answers = [...sample.likert, ...sample.forced];

test('sample interpretation identifies supported internal contrasts with traceable items', () => {
  const model = buildNarrativeReport(scoreAnswers(answers));
  const profiles = Object.fromEntries(model.profiles.map(p => [p.element, p]));
  assert.match(profiles.wind.title, /探索、建模/);
  assert.match(profiles.water.title, /感知细腻/);
  assert.match(profiles.earth.title, /未必天然偏爱稳妥/);
  assert.match(profiles.fire.title, /兴趣更容易点燃行动/);
  for (const profile of model.profiles) for (const item of [...profile.evidence, ...profile.comparison]) {
    assert.equal(item.value, answers[item.id - 1]);
    assert.equal(questions[item.id - 1].element, profile.element);
    assert.ok(item.label);
  }
});

test('pair narratives cover all 12 choices exactly once and retain split decisions', () => {
  const result = scoreAnswers(answers), model = buildNarrativeReport(result);
  assert.equal(model.pairs.length, 6);
  assert.deepEqual(model.pairs.flatMap(p => p.ids).sort((a,b) => a-b), Array.from({length:12},(_,i)=>i+37));
  for (const pair of model.pairs) {
    const selected = pair.ids.map(id => result.forced_detail[id].element);
    assert.equal(pair.winner, selected[0] === selected[1] ? selected[0] : null);
  }
  assert.ok(model.pairs.some(p => p.winner === null));
});

test('flat low responses never become strong core claims or invented contrasts', () => {
  const model = buildNarrativeReport(scoreAnswers([...Array(36).fill(1), ...sample.forced]));
  assert.ok(model.profiles.every(p => p.evidence.length === 0 && p.comparison.length === 0));
  assert.doesNotMatch(model.headline, /核心|探索、建模/);
  assert.match(model.introduction, /相近|没有拉开|未达到/);
});

test('changing the key interest answer removes the selective ignition claim', () => {
  const edited = [...answers]; edited[4] = 1;
  const fire = buildNarrativeReport(scoreAnswers(edited)).profiles.find(p => p.element === 'fire');
  assert.doesNotMatch(fire.title, /兴趣更容易点燃/);
});


test('reading chapters group the sample as wind, water with earth, then fire', () => {
  const model = buildNarrativeReport(scoreAnswers(answers));
  assert.deepEqual(model.readings.map(r => r.elements), [['wind'], ['water', 'earth'], ['fire']]);
  assert.equal(model.readings.flatMap(r => r.elements).length, 4);
});

test('uniform steps are not arbitrarily paired or chained across distant scores', async () => {
  const { readingGroups } = await import('../src/lib/four-elements-reading.ts');
  const result = { ranking: ['wind', 'water', 'earth', 'fire'], composite: { wind: 70, water: 65, earth: 60, fire: 40 } };
  assert.deepEqual(readingGroups(result), [['wind'], ['water'], ['earth'], ['fire']]);
});

test('v3 keeps its original 3+1 prose while v4 uses 2+2 and a neutral proximity note', () => {
  const values = syntheticPairedAnswers(), result = scoreAnswers(values);
  const old = mockAiReport({ answers: values, version: 'deepseek-report-v3' });
  old.readings[0].title = '保留旧版报告原来的三元素章节标题';
  const legacy = buildNarrativeReport(result, old);
  assert.equal(legacy.source, 'ai'); assert.equal(legacy.legacy, true);
  assert.deepEqual(legacy.readings.map(r => r.elements.length), [3, 1]);
  assert.equal(legacy.readings[0].title, old.readings[0].title);
  assert.deepEqual(legacy.readings[0].paragraphs, old.readings[0].paragraphs);
  const modern = buildNarrativeReport(result, mockAiReport({ answers: values }));
  assert.deepEqual(modern.readings.map(r => r.elements.length), [2, 2]);
  assert.deepEqual(modern.readings.map(r => r.label), ['水与火', '风与土']);
  assert.match(modern.distributionNote, /整体接近/);
  assert.doesNotMatch(modern.readingNote, /六分/);
  const mismatch = structuredClone(old); mismatch.version = 'deepseek-report-v4';
  assert.throws(() => buildNarrativeReport(result, mismatch)); // Never substitute local prose for unmatched AI chapters.
});
