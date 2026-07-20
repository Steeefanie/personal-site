import type { CollectionEntry } from 'astro:content';
import { defaultLocale, locales, type Locale, type Localized } from './i18n';

export const slugFromId = (id: string) => id
  .replace(/\\/g, '/')
  .replace(/\.(md|mdx)$/i, '')
  .split('/')
  .slice(1)
  .join('/');

export interface LocalizedGroup<T> {
  slug: string;
  locales: Localized<T>;
}

export function pairEntries<T extends CollectionEntry<'blog'> | CollectionEntry<'projects'> | CollectionEntry<'recipes'>>(entries: T[]) {
  const grouped = new Map<string, Partial<Record<Locale, T>>>();
  for (const entry of entries) {
    const slug = slugFromId(entry.id);
    const group = grouped.get(slug) ?? {};
    group[entry.data.lang] = entry;
    grouped.set(slug, group);
  }

  return [...grouped.entries()]
    .filter((item): item is [string, Localized<T>] => locales.every((locale) => Boolean(item[1][locale])))
    .map(([slug, entriesByLocale]) => ({ slug, locales: entriesByLocale }))
    .sort((a, b) => b.locales[defaultLocale].data.publishDate.getTime() - a.locales[defaultLocale].data.publishDate.getTime());
}
