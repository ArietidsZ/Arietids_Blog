import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { CONTENT_MODE } from 'astro:env/server';
import type { Locale } from '~/i18n';
import { publicationDateReached } from '~/lib/blog';

export const isPreview = (CONTENT_MODE ?? (import.meta.env.DEV ? 'preview' : 'public')) === 'preview';

/** Private articles are never rendered; pending drafts appear only in local preview. */
export async function getNotes(lang?: Locale) {
  const hasNotes = ['src/content/notes', ...(isPreview ? ['.drafts'] : [])].some((directory) => {
    try { return readdirSync(resolve(directory)).some((file) => /\.mdx?$/.test(file)); }
    catch { return false; }
  });
  if (!hasNotes) return [];
  return (await getCollection('notes'))
    .filter((note) => note.data.visibility === 'public' || (isPreview && note.data.visibility === 'pending'))
    .filter((note) => !lang || note.data.lang === lang)
    .filter((note) => isPreview || publicationDateReached(note.data.date))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}

export const noteSlug = (note: CollectionEntry<'notes'>): string => note.id.replace(/\.(zh|en)$/, '');
export const pendingCount = async (): Promise<number> => (await getNotes()).filter((note) => note.data.visibility === 'pending').length;
