import type { APIRoute } from 'astro';
import { htmlLang, localePath, locales, type Locale } from '~/i18n';
import { blogCategories, blogPath, categoryPath } from '~/lib/blog';
import { getNotes, isPreview, noteSlug } from '~/lib/content';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const rows: string[] = [];
  const add = (path: string, lang: Locale, alternates: readonly Locale[]) => {
    const url = (locale: Locale) => escape(new URL(localePath(locale, path), site).href);
    rows.push(`<url><loc>${url(lang)}</loc>${alternates.map((locale) => `<xhtml:link rel="alternate" hreflang="${htmlLang[locale]}" href="${url(locale)}"/>`).join('')}</url>`);
  };
  if (!isPreview) {
    for (const lang of locales) {
      add('/', lang, locales);
      for (const category of blogCategories) add(categoryPath(category), lang, locales);
    }
    const notes = await getNotes();
    for (const note of notes) {
      const slug = noteSlug(note);
      const alternates = notes.filter((entry) => noteSlug(entry) === slug).map((entry) => entry.data.lang);
      add(blogPath(slug), note.data.lang, alternates);
    }
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${rows.join('')}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
