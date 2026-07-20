import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { locales } from './lib/i18n';

const tag = z.object({
  id: z.string(),
  label: z.string(),
});

const shared = {
  title: z.string(),
  description: z.string(),
  publishDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  lang: z.enum(locales),
  featured: z.boolean().default(false),
  cover: z.string().optional(),
  draft: z.boolean().default(false),
};

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    ...shared,
    tags: z.array(tag).default([]),
    readingTime: z.string(),
    attribution: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    ...shared,
    stack: z.array(z.string()).default([]),
    attribution: z.string().optional(),
    demoUrl: z.url().optional(),
    repositoryUrl: z.url().optional(),
    downloadUrl: z.url().optional(),
  }),
});

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/recipes' }),
  schema: z.object({
    ...shared,
    category: z.enum(['home-cooking', 'flour', 'cocktail']),
    prepTime: z.string(),
    servings: z.string(),
    tags: z.array(tag).default([]),
  }),
});

// Keep all localized content collections on the same loader lifecycle so file additions and removals resync together.
export const collections = { blog, projects, recipes };
