// Keep content metadata stable while using concise public category names.
export const recipeCategorySlugs = {
  'home-cooking': 'meals',
  flour: 'dough',
  cocktail: 'cocktails',
} as const;

export type RecipeCategory = keyof typeof recipeCategorySlugs;

export const parseRecipeCategory = (value: string | null): RecipeCategory | undefined => (
  Object.keys(recipeCategorySlugs) as RecipeCategory[]
).find((category) => category === value || recipeCategorySlugs[category] === value);

export const recipeCategorySlug = (value: string): string => {
  const category = parseRecipeCategory(value);
  return category ? recipeCategorySlugs[category] : value;
};
