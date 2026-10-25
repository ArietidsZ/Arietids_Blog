import type { APIRoute } from 'astro';
import { isPreview } from '~/lib/content';

export const GET: APIRoute = ({ site }) => new Response(
  isPreview
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
