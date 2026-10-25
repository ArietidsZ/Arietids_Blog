import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { checkBlogSources, postFiles, readPost } from '../scripts/blog.mjs';
import { blogCategories, isISODate, publicationDateReached } from './lib/blog';

const visibility = z.enum(['public', 'pending', 'private']).default('pending');

// .drafts is local-only. Exclude it before parsing or compiling a public build.
const previewNotes = (process.env.CONTENT_MODE ?? (import.meta.env.DEV ? 'preview' : 'public')) === 'preview';
checkBlogSources();
const sourceNotes = postFiles('src/content/notes');
const draftNotes = previewNotes ? postFiles('.drafts', { allowMediaDirectories: true }) : [];
const seenNotes = new Set<string>();
for (const file of [...sourceNotes, ...draftNotes]) {
  const post = readPost(readFileSync(file, 'utf8'), basename(file));
  if (seenNotes.has(post.id)) throw new Error(`Duplicate article ${post.id} in published source and local drafts.`);
  seenNotes.add(post.id);
}
const futureNotes = previewNotes ? [] : sourceNotes.filter((file) => {
  const post = readPost(readFileSync(file, 'utf8'), basename(file));
  return !publicationDateReached(post.data.date);
});
const calendarDate = z.preprocess(
  (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  z.string().refine(isISODate, 'Use a valid YYYY-MM-DD calendar date').transform((value) => new Date(`${value}T00:00:00.000Z`)),
);

const notes = defineCollection({
  // Keep the language suffix in the id (`about-this-site.zh`); the default slugger would drop the dot.
  loader: glob({
    pattern: [
      'src/content/notes/*.{md,mdx}',
      ...(previewNotes ? ['.drafts/*.{md,mdx}'] : []),
      ...futureNotes.map((file) => `!${file.replaceAll('\\', '/')}`),
    ],
    base: '.',
    deferRender: true,
    generateId: ({ entry, base, data }) => {
      const post = readPost(readFileSync(new URL(entry, base), 'utf8'), basename(entry));
      // Preserve validated raw dates; YAML parsers may otherwise coerce them first.
      data.date = post.data.date;
      data.updated = post.data.updated;
      if (entry.startsWith('.drafts/') && data.visibility !== 'private') data.visibility = 'pending';
      return post.id;
    },
  }),
  schema: z.object({
    visibility,
    title: z.string(),
    description: z.string(),
    category: z.enum(blogCategories),
    lang: z.enum(['zh', 'en']),
    date: calendarDate,
    updated: calendarDate.optional(),
    tags: z.array(z.string()).default([]),
  }).refine((data) => !data.updated || data.updated >= data.date, { path: ['updated'], message: 'updated must be on or after date' }),
});

export const collections = { notes };
