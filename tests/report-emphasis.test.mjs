import assert from 'node:assert/strict';
import test from 'node:test';
import { emphasisRuns, literalEmphasis, resolveEmphasis, paragraphEmphasis } from '../src/lib/report-emphasis.ts';
import { layoutPdfRichText } from '../src/lib/report-pdf-layout.ts';
import { reportMethod } from '../src/lib/four-elements-reading.ts';
test('each paragraph keeps only its first valid emphasis and preserves all text', () => {
  const text = '感受关系，也重视现实落地';
  const runs = emphasisRuns(text, ['感受关系', '关系', '现实落地']);
  assert.deepEqual(runs, [{ text: '感受关系', bold: true }, { text: '，也重视现实落地', bold: false }]);
  assert.equal(runs.map(r => r.text).join(''), text);
  assert.deepEqual(emphasisRuns('不需要强调的原文', ['未出现']), [{ text: '不需要强调的原文', bold: false }]);
});
test('optional emphasis drops labels, repeated phrases and excessive density without rejecting prose', () => {
  assert.deepEqual(literalEmphasis(['敏感'], '敏感不等于由情绪主导，也不决定实际能力。'), []);
  assert.deepEqual(literalEmphasis(['现实落地'], '重视现实落地，同时也会反复思考现实落地。'), []);
  assert.deepEqual(literalEmphasis(['这就是全部的判断'], '这就是全部的判断'), []);
  assert.deepEqual(literalEmphasis([], '没有加粗也应当完整保留这段文字。'), []);
  assert.deepEqual(literalEmphasis(['但未必偏爱稳定'], '你重视落地，但未必偏爱稳定，也能适应必要的变化。'), ['但未必偏爱稳定']);
});
test('paragraph boundaries prevent cross-paragraph matches and repetition', () => {
  const paragraphs = ['你重视现实落地，也会留出空间继续探索。', '但未必偏爱稳定，可以根据情境调整方式。'];
  assert.deepEqual(literalEmphasis(['但未必偏爱稳定', '重视现实落地'], paragraphs), ['重视现实落地', '但未必偏爱稳定']);
  assert.deepEqual(literalEmphasis(['继续探索。但未必'], paragraphs), []);
  assert.deepEqual(literalEmphasis(['重视现实落地'], [...paragraphs, paragraphs[0]]), []);
});
test('fixed method explanations share complete emphasis phrases across HTML and PDF', () => {
  for (const part of reportMethod) {
    assert.deepEqual(literalEmphasis(part.emphasis, part.text), part.emphasis);
    const html = emphasisRuns(part.text, part.emphasis);
    const cut = part.text.indexOf(part.emphasis[0]) + 3;
    const pdf = [...emphasisRuns(part.text, part.emphasis, { start: 0, end: cut }), ...emphasisRuns(part.text, part.emphasis, { start: cut, end: part.text.length })];
    assert.equal(html.filter(r => r.bold).map(r => r.text).join(''), pdf.filter(r => r.bold).map(r => r.text).join(''));
  }
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

const fakeFont = { widthOfTextAtSize: (text, size) => [...text].length * size };
const boldText = runs => runs.filter(r => r.bold).map(r => r.text).join('');

test('resolved positions keep negation and conditions across HTML, PDF indent and line breaks', () => {
  const paragraphs = ['你重视落地，但未必偏爱稳定，也能适应必要的变化。', '面对新的任务，如果信息不足，先确认边界可能比立即决定更合适。'];
  const emphasis = resolveEmphasis(['但未必偏爱稳定', '如果信息不足', '适应必要的变化'], paragraphs);
  assert.equal(boldText(emphasisRuns(paragraphs[0], emphasis)), '但未必偏爱稳定');
  assert.equal(boldText(emphasisRuns(paragraphs[1], emphasis)), '如果信息不足');
  paragraphs.forEach(text => {
    for (const indent of [false, true]) for (const width of [70, 100, 300]) {
      const pdf = layoutPdfRichText(text, width, 10, fakeFont, fakeFont, emphasis, indent);
      assert.equal(boldText(pdf.rows.flatMap(r => r.runs)), boldText(emphasisRuns(text, emphasis)));
      assert.equal(pdf.rows.flatMap(r => r.runs).map(r => r.text).join(''), (indent ? '　　' : '') + text);
    }
  });
});

test('resolved modules reject repeated positions, title overlap and whitespace-induced density changes', () => {
  const text = '重视现实落地，也能灵活调整安排。';
  const emphasis = resolveEmphasis(['重视现实落地', '灵活调整安排'], [text], ['重视现实落地']);
  assert.equal(boldText(emphasisRuns(text, emphasis)), '灵活调整安排');
  assert.deepEqual(paragraphEmphasis('另一段没有指定重点的原文', emphasis), []);
  const repeated = resolveEmphasis(['现实落地'], ['你重视现实落地，也会继续探索。', '现实落地同样需要考虑周围条件。']);
  assert.ok([...repeated.values()].every(r => r.length === 0));
  const dense = '重视现实落地，能够调整安排';
  for (const indent of [false, true]) {
    const pdf = layoutPdfRichText(dense, 100, 10, fakeFont, fakeFont, ['重视现实落地，'], indent);
    assert.equal(boldText(pdf.rows.flatMap(r => r.runs)), '');
  }
});
