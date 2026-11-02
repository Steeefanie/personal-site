import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/lib/recipe-categories.ts', import.meta.url), 'utf8'));
const { parseRecipeCategory, recipeCategorySlug } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('old and new category URLs resolve to the same content and emit only the new slug', () => {
  for (const [legacy, slug] of [['home-cooking', 'meals'], ['flour', 'dough'], ['cocktail', 'cocktails']]) {
    assert.equal(parseRecipeCategory(legacy), legacy);
    assert.equal(parseRecipeCategory(slug), legacy);
    assert.equal(recipeCategorySlug(legacy), slug);
    assert.equal(recipeCategorySlug(slug), slug);
  }
});

test('empty and unsupported categories do not select a content category', () => {
  for (const value of ['', null, 'unknown', 'toString']) assert.equal(parseRecipeCategory(value), undefined);
});
