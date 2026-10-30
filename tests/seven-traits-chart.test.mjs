import assert from 'node:assert/strict';
import test from 'node:test';
import { radarGeometry } from '../src/lib/seven-traits-chart-layout.ts';
import { scoreAnswers } from '../src/lib/seven-traits.ts';

test('desktop and mobile radar keep the same independent axes and visible labels', () => {
  const result = scoreAnswers(Array.from({ length: 56 }, (_, i) => i % 5 + 1));
  for (const compact of [false, true]) {
    const g = radarGeometry(result, compact);
    assert.equal(g.labels.length, 14); assert.deepEqual(g.sides.map(s => s.length), [7, 7]);
    for (let i = 0; i < 14; i += 2) {
      assert.ok(Math.abs(g.labels[i].x + g.labels[i + 1].x - g.cx * 2) < .001);
      assert.ok(Math.abs(g.labels[i].y + g.labels[i + 1].y - g.cy * 2) < .001);
    }
    g.labels.forEach(label => { assert.ok(label.x > 20 && label.x < g.width - 20); assert.ok(label.y > 20 && label.y < g.height - 20); });
    assert.equal(/\d/.test(g.labels[0].text), true);
  }
});
