/**
 * Cross-document view transitions: the title of the article you open grows into its heading
 * (which carries its name statically), and shrinks back into its row when you return. The leaving
 * page names the title that matches the destination; the arriving page names the row it came back
 * to in an inline script in Base.astro, since `pagereveal` fires before module scripts run. Names
 * are set only for the navigation that needs them, so theme transitions are unaffected.
 */
const RESERVED = new Set(['blog', 'category', 'en', 'index', 'notes', 'rss']);
const slug = (url: string | undefined) => {
  const m = url && new URL(url).pathname.match(/^\/(?:en\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  return m && !RESERVED.has(m[1]!) ? m[1] : undefined;
};

addEventListener('pageswap', (e: Event) => {
  const ev = e as Event & { viewTransition?: ViewTransition | null; activation?: { entry?: { url?: string } } | null };
  const id = slug(ev.activation?.entry?.url);
  if (!ev.viewTransition || !id) return;
  const el = document.querySelector<HTMLElement>(`[data-vt-title="${CSS.escape(id)}"]`);
  if (!el || el.style.viewTransitionName) return;
  el.style.viewTransitionName = `t-${id}`;
  ev.viewTransition.finished.finally(() => (el.style.viewTransitionName = ''));
});

export {};
