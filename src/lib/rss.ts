import rss from '@astrojs/rss';
import { site as blogSite } from '~/config/site';
import { localePath, t, type Locale } from '~/i18n';
import { getNotes, noteSlug } from '~/lib/content';
import { blogPath, categoryDescription, categoryLabel, categoryPath, type BlogCategory } from '~/lib/blog';

export async function notesFeed(lang: Locale, site: URL, category?: BlogCategory) {
  const _ = t(lang);
  const notes = (await getNotes(lang)).filter((n) => !category || n.data.category === category);
  const siteName = blogSite.name;
  return rss({
    title: `${siteName} · ${category ? categoryLabel(category, lang) : _('notes.title')}`,
    description: category ? categoryDescription(category, lang) : _('notes.lede'),
    site: new URL(localePath(lang, category ? categoryPath(category) : '/'), site).href,
    items: notes.map((n) => ({
      title: n.data.title,
      description: n.data.description,
      pubDate: n.data.date,
      link: new URL(localePath(lang, blogPath(noteSlug(n))), site).href,
      categories: [categoryLabel(n.data.category, lang), ...n.data.tags],
    })),
    customData: `<language>${lang === 'zh' ? 'zh-cn' : 'en'}</language>`,
  });
}
