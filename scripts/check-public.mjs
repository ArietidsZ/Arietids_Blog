#!/usr/bin/env node
/** Checks the public artifact, including feed/metadata payloads and approved image sources. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { publicationDateReached } from '../src/lib/blog.ts';

const DEFAULT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.cjs', '.json', '.xml', '.txt', '.map', '.svg', '.css', '.md', '.mdx', '.csv', '.yaml', '.yml']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);
const INTERNAL_KEYS = new Set(['id', 'collection', 'visibility', 'ref', 'evidence', 'sources', 'review', 'themes', 'asset', 'kind', 'status', 'order', 'featured', 'date', 'updated', 'category', 'year', 'period', 'lang', 'tags']);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object')
    return Object.entries(value).filter(([key]) => !INTERNAL_KEYS.has(key)).flatMap(([, v]) => strings(v));
  return [];
}

/** Compare the same value through HTML/XML entities and ordinary JSON/JS escapes. */
function decoded(text) {
  return text
    .replace(/\\u([a-f0-9]{4})/gi, (_, v) => String.fromCharCode(parseInt(v, 16)))
    .replace(/\\x([a-f0-9]{2})/gi, (_, v) => String.fromCharCode(parseInt(v, 16)))
    .replace(/&#x([a-f0-9]+);/gi, (_, v) => String.fromCodePoint(parseInt(v, 16)))
    .replace(/&#([0-9]+);/g, (_, v) => String.fromCodePoint(Number(v)))
    .replace(/&(amp|quot|apos|lt|gt);/g, (_, v) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[v])
    .replace(/\\(["'\/])/g, '$1');
}

/** JSON string values carry decoded control characters; keep each value a separate match boundary. */
function serializedStrings(text) {
  const values = [];
  try {
    JSON.parse(text, (_key, value) => {
      if (typeof value === 'string') values.push(value);
      return value;
    });
  } catch {
    return [];
  }
  return values;
}

/** Compare visible text across markup, invisible breaks, and typographic dashes. */
export function readable(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ');
}

function hasValue(text, value, plain = readable(text)) {
  if (!value) return false;
  const visible = readable(value).trim();
  return text.includes(value) || text.includes(encodeURIComponent(value)) || (visible.length > 0 && plain.includes(visible));
}

/** Long enough to identify an entry: eight characters, or four when it contains Han (denser). */
const distinctive = (value) => value.length >= 8 || (/\p{Script=Han}/u.test(value) && value.length >= 4);

function routes(entry) {
  const slug = entry.id.replace(/\.(zh|en)$/, '');
  return [`${entry.lang === 'en' ? '/en' : ''}/${slug}/`];
}

function hasRoute(text, route) {
  const path = route.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const origin = route.startsWith('https://') ? '' : '(?:https?://[^\\s/"\'`<>]+)?';
  return new RegExp('(?:^|[\\s"\'`<>=\\(])' + origin + path + '(?=[/?#\\s"\'`<>)]|$)').test(text);
}

export function checkPublic(root = DEFAULT_ROOT, dist = join(root, 'dist'), now = new Date()) {
  const problems = [];
  if (!existsSync(dist)) return { problems: ['Public output not found — run npm run build first.'], files: 0, textFiles: 0 };
  const content = join(root, 'src/content');
  const entries = [];
  const draftDir = join(root, '.drafts');
  for (const noteDir of [join(content, 'notes'), draftDir]) {
    if (!existsSync(noteDir)) continue;
    for (const file of walk(noteDir).filter((f) => /\.mdx?$/.test(f))) {
      const raw = readFileSync(file, 'utf8');
      const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      const localDraft = noteDir === draftDir;
      let data = {};
      let rawDraft;
      try { data = front ? parse(front[1]) : {}; }
      catch (error) {
        if (!localDraft) throw error;
        // An unfinished local edit must not block the unrelated public build. Keep its raw
        // source and body in the leak checks even when frontmatter cannot yet be parsed.
        rawDraft = raw;
      }
      entries.push({ ...data, lang: data?.lang ?? basename(file).match(/\.(zh|en)\.mdx?$/)?.[1], id: relative(noteDir, file).replace(/\\/g, '/').replace(/\.mdx?$/, ''), collection: 'notes', localDraft, rawDraft, body: raw.slice(front?.[0].length ?? 0) });
    }
  }
  const approvedEntry = (entry) => entry.visibility === 'public' && !entry.localDraft &&
    publicationDateReached(entry.date, now);
  const approvedEntries = entries.filter(approvedEntry);
  const approved = approvedEntries.flatMap(strings);
  const approvedValue = (value) => approved.some((s) => s.includes(value));
  const approvedRoutes = new Set(approvedEntries.flatMap(routes));
  const withheldRoutes = entries.filter((e) => !approvedEntry(e))
    .flatMap((entry) => routes(entry).filter((route) => !approvedRoutes.has(route)).map((route) => ({ route, entry })));
  // Files under public/ are copied verbatim. A published article explicitly approves its entire
  // blog-media/{slug}/ directory; an unknown hashed MDX import is not implicitly approved.
  const publicPostSlugs = new Set(approvedEntries.map((e) => e.id.replace(/\.(zh|en)$/, '')));
  const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
  const draftFiles = existsSync(draftDir) ? walk(draftDir) : [];
  const draftDigests = new Set(draftFiles.filter((file) => statSync(file).size > 0).map(digest));
  const forbidden = [];
  for (const entry of entries) {
    if (entry.review?.length > 8) forbidden.push({ value: entry.review, key: `${entry.collection}:${entry.id} review` });
    if (approvedEntry(entry)) continue;
    for (const value of strings(entry)) {
      if (distinctive(value) && !approvedValue(value))
        forbidden.push({ value, key: `${entry.collection}:${entry.id}` });
    }
  }
  for (const file of draftFiles.filter((file) => TEXT_EXTENSIONS.has(extname(file).toLowerCase()) && !/\.mdx?$/.test(file))) {
    const value = readFileSync(file, 'utf8');
    if (distinctive(value) && !approvedValue(value)) forbidden.push({ value, key: `local draft:${relative(draftDir, file)}`, draftAsset: true });
  }

  const files = walk(dist);
  const approvedMediaFiles = new Set();
  let textFiles = 0;
  for (const file of files) {
    const rel = relative(dist, file).split('\\').join('/');
    if (/^review(?:\/|\.|$)/.test(rel)) problems.push(`${rel}: review output in public artifact`);
    if (rel.startsWith('blog-media/')) {
      const slug = rel.split('/')[1];
      const source = join(root, 'public', rel);
      if (publicPostSlugs.has(slug) && existsSync(source) && statSync(source).isFile() && digest(file) === digest(source))
        approvedMediaFiles.add(rel);
      else problems.push(`${rel}: media has no published article or does not match its public source`);
    }
    // Copying an asset into an approved article's public package is an explicit publication
    // decision; another draft may still reference the local copy. Other destinations stay blocked.
    if (/(?:^|\/)\.drafts(?:\/|$)/.test(rel) || (!approvedMediaFiles.has(rel) && draftDigests.has(digest(file))))
      problems.push(`${rel}: local draft file or asset in public artifact`);
    for (const { route, entry } of withheldRoutes) {
      if (rel === `${route.slice(1)}index.html`)
        problems.push(`${rel}: route belongs to unapproved ${entry.collection}:${entry.id}`);
    }
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    textFiles++;
    const source = readFileSync(file, 'utf8');
    const text = decoded(source);
    const plain = readable(text);
    const serialized = serializedStrings(source).map((value) => {
      const text = decoded(value);
      return { text, plain: readable(text) };
    });
    if (/data-visibility=["'](?:pending|private)["']/.test(text)) problems.push(`${rel}: non-public visibility marker`);
    if (text.includes('data-preview-bar')) problems.push(`${rel}: preview bar present`);
    for (const { value, key, draftAsset } of forbidden) {
      if (draftAsset && approvedMediaFiles.has(rel) && source === value) continue;
      if (hasValue(text, value, plain) || serialized.some((s) => hasValue(s.text, value, s.plain)))
        problems.push(`${rel}: contains text from ${key}`);
    }
    for (const { route, entry } of withheldRoutes) {
      if (hasRoute(text, route)) problems.push(`${rel}: contains an unapproved ${entry.collection} route`);
    }
  }

  for (const file of files.filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))) {
    const rel = relative(dist, file).split('\\').join('/');
    if (approvedMediaFiles.has(rel) || rel === 'favicon.svg') continue;
    problems.push(`${rel}: image has no published article media source`);
  }

  return { problems: [...new Set(problems)], files: files.length, textFiles };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkPublic();
  if (result.problems.length) {
    console.error(`\n✗ Public artifact check failed (${result.problems.length}):\n  - ${result.problems.join('\n  - ')}\n`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Public artifact checks passed: ${result.textFiles} text files, ${result.files} total files; checked known unapproved content, routes and image sources.`);
  }
}
