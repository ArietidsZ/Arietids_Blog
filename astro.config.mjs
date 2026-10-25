// @ts-check
import { defineConfig, envField } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import { focusableTables } from './integrations/focusable-tables.mjs';

const site = process.env.SITE_URL ?? 'https://blog.arietids.net';

export default defineConfig({
  site,
  output: 'static',
  outDir: process.env.CONTENT_MODE === 'preview' ? './out' : './dist',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  i18n: {
    locales: ['zh', 'en'],
    defaultLocale: 'zh',
    routing: { prefixDefaultLocale: false },
  },
  env: {
    schema: {
      // Unset: `preview` under `astro dev`, `public` under `astro build`.
      CONTENT_MODE: envField.enum({
        context: 'server',
        access: 'public',
        values: ['public', 'preview'],
        optional: true,
      }),
    },
  },
  integrations: [mdx()],
  devToolbar: { enabled: false },
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex, focusableTables] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
