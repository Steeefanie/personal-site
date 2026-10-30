import assert from 'node:assert/strict';
import test from 'node:test';
import { emphasisRuns } from '../src/lib/report-emphasis.ts';
test('literal emphasis preserves all text and merges overlapping keyword ranges', () => {
  const text = '感受关系，也重视现实落地';
  const runs = emphasisRuns(text, ['感受关系', '关系', '现实落地']);
  assert.deepEqual(runs, [{ text: '感受关系', bold: true }, { text: '，也重视', bold: false }, { text: '现实落地', bold: true }]);
  assert.equal(runs.map(r => r.text).join(''), text);
  assert.deepEqual(emphasisRuns('不需要强调的原文', ['未出现']), [{ text: '不需要强调的原文', bold: false }]);
});
test('a highlighted phrase remains bold on both sides of a PDF line break', () => {
  const text = '你更在意答案在知识结构中的位置，而非孤立记忆';
  const split = text.indexOf('的位置');
  const first = emphasisRuns(text, ['答案在知识结构中的位置'], { start: 0, end: split });
  const second = emphasisRuns(text, ['答案在知识结构中的位置'], { start: split, end: text.length });
  assert.equal(first.at(-1).bold, true);
  assert.deepEqual(second[0], { text: '的位置', bold: true });
  assert.equal([...first, ...second].map(r => r.text).join(''), text);
});
