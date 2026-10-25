#!/usr/bin/env node
/** Validate the standalone production artifact without using application URL helpers. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const blog = 'https://blog.arietids.net';
const home = 'https://arietids.net';
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? files(path) : [path];
});
const decode = text => text.replaceAll('&amp;', '&');
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(match => Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])])));
const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decode(m[1]));
const read = path => readFileSync(join(root, path), 'utf8');
const pages = new Set();
let articles = 0;
for (const file of files(root).filter(file => file.endsWith('.html'))) {
  const path = relative(root, file).replaceAll('\\', '/');
  const html = readFileSync(file, 'utf8');
  const links = tags(html, 'link');
  const canonical = links.find(link => link.rel === 'canonical')?.href;
  assert(canonical, `${path}: missing canonical`);
  const route = path === 'index.html' ? '/' : `/${path.replace(/index\.html$/, '')}`;
  const english = route.startsWith('/en/');
  const localizedRoot = english ? '/en/' : '/';
  if (path === '404.html') assert.equal(new URL(canonical).origin, blog);
  else {
    assert.equal(canonical, blog + route, `${path}: canonical`);
    pages.add(canonical);
  }
  assert.equal(tags(html, 'meta').find(meta => meta.property === 'og:url')?.content, canonical, `${path}: og:url`);
  assert.equal(new URL(links.find(link => link.type === 'application/rss+xml')?.href, canonical).href, blog + localizedRoot + 'rss.xml', `${path}: RSS alternate`);
  for (const alternate of links.filter(link => link.hreflang)) {
    assert.equal(new URL(alternate.href).origin, blog, `${path}: alternate origin`);
    assert(!/\/(?:blog|notes)\//.test(new URL(alternate.href).pathname), `${path}: legacy alternate prefix`);
  }
  if (path !== '404.html') {
    const header = html.match(/<header\b[^>]*class="[^"]*site-header[\s\S]*?<\/header>/)?.[0];
    assert(header, `${path}: missing header`);
    const anchors = tags(header, 'a');
    assert.equal(anchors.find(a => a.class?.split(/\s+/).includes('brand'))?.href, localizedRoot, `${path}: blog brand destination`);
    assert(anchors.some(a => a.href === home + localizedRoot && a.rel === 'external'), `${path}: personal site external link`);
    for (const category of ['tech', 'study', 'research']) assert(anchors.some(a => a.href === localizedRoot + 'category/' + category + '/'), `${path}: category navigation`);
  }
  for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(match[1]);
    if (data['@type'] === 'Blog') assert.equal(data.url, blog + '/');
    if (data['@type'] !== 'BlogPosting') continue;
    articles++;
    assert.equal(data.url, canonical);
    assert.equal(data.mainEntityOfPage, canonical);
    if (data.author?.url) assert.equal(new URL(data.author.url).origin, home);
  }
}
assert.deepEqual(new Set(locs(read('sitemap.xml'))), pages, 'Sitemap exactly covers public blog pages');
assert(read('robots.txt').includes(`Sitemap: ${blog}/sitemap.xml`));
let feeds = 0;
for (const file of files(root).filter(file => /(?:^|\/)rss\.xml$/.test(file))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/<link>([^<]+)<\/link>/g)) {
    const url = new URL(decode(match[1]));
    assert.equal(url.origin, blog, `${file}: RSS origin`);
    assert(!/\/(?:blog|notes)\//.test(url.pathname), `${file}: RSS legacy prefix`);
  }
  feeds++;
}
assert.equal(feeds, 8, 'Overall and three category feeds in both languages');
console.log(JSON.stringify({ passed: true, pages: pages.size, articles, feeds, origin: blog }));
