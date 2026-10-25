import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { stringify } from 'yaml';
import { checkPublic } from './check-public.mjs';

const NOW = new Date('2026-10-25T04:00:00Z');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'blog-public-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), value);
  };
  write('dist/index.html', '<title>Arietids Blog</title>');
  return { root, write, problems: (now = NOW) => checkPublic(root, join(root, 'dist'), now).problems };
}
const post = (data = {}, body = 'UNPUBLISHED_BODY_CANARY_9245') => `---\n${stringify({ title: 'Distinct article title', description: 'ARTICLE_DESCRIPTION_CANARY_9245', category: 'research', lang: 'zh', date: '2026-10-01', visibility: 'pending', ...data })}---\n\n${body}\n`;

test('missing artifact fails and an empty public blog passes', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.problems(), []);
  rmSync(join(f.root, 'dist'), { recursive: true });
  assert.match(f.problems()[0], /Public output not found/);
});

test('a due public article and its explicit media package pass', (t) => {
  const f = fixture(t);
  const image = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>';
  f.write('src/content/notes/released.zh.md', post({ visibility: 'public' }));
  f.write('dist/released/index.html', '<p>UNPUBLISHED_BODY_CANARY_9245</p>');
  f.write('dist/rss.xml', '<link>https://blog.arietids.net/released/</link>');
  f.write('public/blog-media/released/chart.svg', image);
  f.write('dist/blog-media/released/chart.svg', image);
  f.write('dist/favicon.svg', '<svg/>');
  assert.deepEqual(f.problems(), []);
});

for (const [name, data] of [['pending', {}], ['private', { visibility: 'private' }], ['future', { visibility: 'public', date: '2099-01-01' }]]) {
  test(`${name} article routes, text, metadata and media are withheld`, (t) => {
    const f = fixture(t);
    f.write(`src/content/notes/${name}.zh.md`, post(data));
    f.write(`dist/${name}/index.html`, '<p>UNPUBLISHED_BODY_CANARY_9245</p>');
    f.write('dist/sitemap.xml', `<loc>https://blog.arietids.net/${name}/</loc>`);
    f.write(`public/blog-media/${name}/chart.svg`, '<svg/>');
    f.write(`dist/blog-media/${name}/chart.svg`, '<svg/>');
    const problems = f.problems();
    assert(problems.some(p => p.startsWith(`${name}/index.html: route belongs`)));
    assert(problems.some(p => p.startsWith(`${name}/index.html: contains text`)));
    assert(problems.some(p => p.startsWith('sitemap.xml: contains an unapproved notes route')));
    assert(problems.some(p => p.includes('media has no published article')));
  });
}

test('publication cutoff follows the Shanghai calendar', (t) => {
  const f = fixture(t);
  f.write('src/content/notes/today.zh.md', post({ visibility: 'public', date: '2026-10-25' }));
  f.write('dist/today/index.html', '<p>UNPUBLISHED_BODY_CANARY_9245</p>');
  assert(f.problems(new Date('2026-10-24T15:59:59Z')).length > 0);
  assert.deepEqual(f.problems(new Date('2026-10-24T16:00:00Z')), []);
});

test('a local draft stays private even with public frontmatter', (t) => {
  const f = fixture(t);
  f.write('.drafts/local.zh.md', post({ visibility: 'public' }));
  f.write('dist/local/index.html', '<p>UNPUBLISHED_BODY_CANARY_9245</p>');
  assert(f.problems().some(p => p.includes('route belongs to unapproved notes:local.zh')));
});

test('English withheld routes use the native English root', (t) => {
  const f = fixture(t);
  f.write('.drafts/english.en.md', post({ lang: 'en' }));
  f.write('dist/en/rss.xml', '<link>https://blog.arietids.net/en/english/?source=rss</link>');
  assert(f.problems().some(p => p.startsWith('en/rss.xml: contains an unapproved notes route')));
});

test('unfinished local frontmatter is tolerated but its body and route cannot leak', (t) => {
  const f = fixture(t);
  f.write('.drafts/unfinished.zh.md', '---\ntitle: [unfinished\n---\n\nUNFINISHED_DRAFT_BODY_CANARY\n');
  assert.deepEqual(f.problems(), []);
  f.write('dist/unfinished/index.html', '<p>UNFINISHED_DRAFT_BODY_CANARY</p>');
  assert(f.problems().some(p => p.includes('route belongs')));
  assert(f.problems().some(p => p.includes('contains text')));
});

test('escaped metadata and typographic text cannot hide withheld content', (t) => {
  const f = fixture(t);
  f.write('.drafts/secret.zh.md', post({ title: '未公开研究数据', description: 'Tom & Ada experiment' }));
  f.write('dist/index.html', '<h1>未公开<span>研究</span>数\u200b据</h1><meta content="Tom &amp; Ada experiment">');
  f.write('dist/data.json', JSON.stringify({ title: '未公开研究数据' }).replaceAll('未', '\\u672a'));
  assert(f.problems().some(p => p.startsWith('index.html: contains text')));
  assert(f.problems().some(p => p.startsWith('data.json: contains text')));
});

test('review annotations and preview controls are never public', (t) => {
  const f = fixture(t);
  f.write('src/content/notes/released.zh.md', post({ visibility: 'public', review: 'INTERNAL_REVIEW_CANARY_9245' }));
  f.write('dist/index.html', '<div data-preview-bar data-visibility="pending">INTERNAL_REVIEW_CANARY_9245</div>');
  f.write('dist/review/index.html', 'review');
  assert(f.problems().some(p => p.includes('review output')));
  assert(f.problems().some(p => p.includes('notes:released.zh review')));
  assert(f.problems().some(p => p.includes('preview bar')));
  assert(f.problems().some(p => p.includes('non-public visibility')));
});

test('renamed binary and text draft attachments are caught', (t) => {
  const f = fixture(t);
  f.write('.drafts/attachment.pdf', Buffer.from([0, 10, 22, 33, 44]));
  f.write('dist/renamed.dat', Buffer.from([0, 10, 22, 33, 44]));
  f.write('.drafts/research.txt', 'PRIVATE_ATTACHMENT_CANARY_9245');
  f.write('dist/app.js', 'const hidden="PRIVATE_ATTACHMENT_CANARY_9245";');
  assert(f.problems().some(p => p.startsWith('renamed.dat: local draft')));
  assert(f.problems().some(p => p.startsWith('app.js: contains text')));
});

test('approved media must match its explicit source and unknown hashed images fail', (t) => {
  const f = fixture(t);
  f.write('src/content/notes/released.zh.md', post({ visibility: 'public' }));
  f.write('public/blog-media/released/chart.svg', '<svg id="approved"/>');
  f.write('dist/blog-media/released/chart.svg', '<svg id="different"/>');
  f.write('dist/_astro/imported.hash.avif', Buffer.from([1, 2, 3]));
  assert(f.problems().some(p => p.includes('does not match its public source')));
  assert(f.problems().some(p => p.startsWith('_astro/imported.hash.avif: image has no')));
});

test('explicitly approved media may retain a draft copy, but not an unrelated public copy', (t) => {
  const f = fixture(t);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" id="shared-approved"/>';
  f.write('src/content/notes/released.zh.md', post({ visibility: 'public' }));
  f.write('.drafts/chart.svg', svg);
  f.write('public/blog-media/released/chart.svg', svg);
  f.write('dist/blog-media/released/chart.svg', svg);
  assert.deepEqual(f.problems(), []);
  f.write('dist/unrelated.dat', svg);
  assert(f.problems().some(p => p.startsWith('unrelated.dat: local draft')));
});

test('shared approved wording does not produce a false positive', (t) => {
  const f = fixture(t);
  f.write('.drafts/draft.zh.md', post());
  f.write('src/content/notes/released.zh.md', post({ visibility: 'public' }));
  f.write('dist/index.html', '<p>Distinct article title UNPUBLISHED_BODY_CANARY_9245</p>');
  assert.deepEqual(f.problems(), []);
});

test('a zero-byte draft file does not invalidate an unrelated empty output', (t) => {
  const f = fixture(t);
  f.write('.drafts/empty.txt', '');
  f.write('dist/empty.txt', '');
  assert.deepEqual(f.problems(), []);
});
