import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { pairEntries } from '../lib/content';
import { locales, ui } from '../lib/i18n';

export const prerender = true;

export const GET: APIRoute = async () => {
  const [blogs, projects, recipes] = await Promise.all([
    getCollection('blog', ({ data }) => !data.draft),
    getCollection('projects', ({ data }) => !data.draft),
    getCollection('recipes', ({ data }) => !data.draft),
  ]);

  const records = [
    ...pairEntries(blogs).map((group) => ({
      id: `blog:${group.slug}`,
      section: 'blog' as const,
      url: `/blog/${group.slug}/`,
      publishDate: group.locales['zh-CN'].data.publishDate.toISOString(),
      locales: Object.fromEntries(locales.map((locale) => [locale, {
        title: group.locales[locale].data.title,
        description: group.locales[locale].data.description,
        keywords: group.locales[locale].data.tags.map((tag) => tag.label),
      }])),
    })),
    ...pairEntries(projects).map((group) => ({
      id: `projects:${group.slug}`,
      section: 'projects' as const,
      url: `/projects/${group.slug}/`,
      publishDate: group.locales['zh-CN'].data.publishDate.toISOString(),
      locales: Object.fromEntries(locales.map((locale) => [locale, {
        title: group.locales[locale].data.title,
        description: group.locales[locale].data.description,
        keywords: group.locales[locale].data.stack,
      }])),
    })),
    ...pairEntries(recipes).map((group) => ({
      id: `recipes:${group.slug}`,
      section: 'recipes' as const,
      url: `/recipes/${group.slug}/`,
      publishDate: group.locales['zh-CN'].data.publishDate.toISOString(),
      locales: Object.fromEntries(locales.map((locale) => [locale, {
        title: group.locales[locale].data.title,
        description: group.locales[locale].data.description,
        keywords: [
          ...group.locales[locale].data.tags.map((tag) => tag.label),
          ui.category[group.locales[locale].data.category][locale],
        ],
      }])),
      filters: {
        category: group.locales['zh-CN'].data.category,
      },
    })),
  ].sort((a, b) => Date.parse(b.publishDate) - Date.parse(a.publishDate));

  return new Response(JSON.stringify(records), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
