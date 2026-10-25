/**
 * Article typesetting at build time, so pages need no script to look finished:
 *
 *  - code blocks get a caption bar with the language and a copy button (hidden until the page's
 *    script can copy; scripts/code.ts);
 *  - Chinese headings break only between phrases (see src/lib/typeset.ts);
 *  - emphasis on Chinese text takes emphasis dots (着重号), the Chinese convention, since there is
 *    no Chinese italic;
 *  - footnotes in Chinese articles are labelled in Chinese.
 *
 * The article's language comes from its frontmatter (`lang`), else from its file name.
 */
import { breakable } from '../src/lib/typeset.ts';

const LANGUAGES = {
  ts: 'TypeScript', tsx: 'TSX', typescript: 'TypeScript', js: 'JavaScript', jsx: 'JSX', javascript: 'JavaScript', mjs: 'JavaScript',
  py: 'Python', python: 'Python', sh: 'Shell', bash: 'Shell', zsh: 'Shell', shell: 'Shell', shellscript: 'Shell', console: 'Console',
  json: 'JSON', jsonc: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', css: 'CSS', scss: 'SCSS', html: 'HTML', xml: 'XML', svg: 'SVG',
  md: 'Markdown', markdown: 'Markdown', mdx: 'MDX', astro: 'Astro', vue: 'Vue', svelte: 'Svelte', sql: 'SQL', graphql: 'GraphQL',
  rust: 'Rust', rs: 'Rust', go: 'Go', c: 'C', cpp: 'C++', 'c++': 'C++', h: 'C', cs: 'C#', csharp: 'C#', java: 'Java', kotlin: 'Kotlin',
  kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', ruby: 'Ruby', php: 'PHP', r: 'R', julia: 'Julia', matlab: 'MATLAB', lua: 'Lua',
  tex: 'LaTeX', latex: 'LaTeX', dockerfile: 'Dockerfile', docker: 'Dockerfile', diff: 'Diff', ini: 'INI', nginx: 'Nginx',
  cuda: 'CUDA', glsl: 'GLSL', wgsl: 'WGSL', zig: 'Zig', haskell: 'Haskell', ocaml: 'OCaml', scala: 'Scala', dart: 'Dart',
};
const HAN_ONLY = /^[\p{Script=Han}\p{P}\s]+$/u;
const HAS_HAN = /\p{Script=Han}/u;

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(text).join(''));
const classes = (node) => [node.properties?.className ?? []].flat().map(String);

function language(file) {
  const fromFront = file.data?.astro?.frontmatter?.lang;
  if (fromFront === 'zh' || fromFront === 'en') return fromFront;
  return /\.zh\.mdx?$/.test(String(file.path ?? '')) ? 'zh' : 'en';
}

export function articleTypography() {
  return (tree, file) => {
    const zh = language(file) === 'zh';
    const visit = (node, parent, index) => {
      if (node.type !== 'element') {
        for (const [i, child] of (node.children ?? []).entries()) visit(child, node, i);
        return;
      }
      // Code: a figure with a caption bar. The button is hidden until a script can copy.
      if (node.tagName === 'pre' && parent && parent.tagName !== 'figure') {
        const lang = String(node.properties?.dataLanguage ?? '').toLowerCase();
        const name = LANGUAGES[lang] ?? (lang && lang !== 'plaintext' && lang !== 'text' && lang !== 'txt' ? lang.toUpperCase() : '');
        parent.children[index] = el('figure', { className: ['code'], dataLang: lang || undefined }, [
          el('figcaption', { className: ['code-bar'] }, [
            el('span', { className: ['code-lang'] }, name ? [{ type: 'text', value: name }] : []),
            el('button', { type: 'button', className: ['code-copy'], dataCodeCopy: '', dataCopied: zh ? '已复制' : 'Copied', hidden: true }, [
              el('span', { dataLabel: '' }, [{ type: 'text', value: zh ? '复制' : 'Copy' }]),
            ]),
          ]),
          node,
        ]);
        return;
      }
      if (zh && /^h[2-4]$/.test(node.tagName)) {
        const walk = (n) => {
          if (n.type === 'text' && HAS_HAN.test(n.value)) n.value = breakable(n.value);
          (n.children ?? []).forEach(walk);
        };
        walk(node);
      }
      if (node.tagName === 'em' && HAN_ONLY.test(text(node)) && HAS_HAN.test(text(node))) {
        node.properties = { ...node.properties, className: [...classes(node), 'dots'] };
      }
      if (zh && node.tagName === 'h2' && node.properties?.id === 'footnote-label') node.children = [{ type: 'text', value: '脚注' }];
      if (zh && node.tagName === 'a' && node.properties?.dataFootnoteBackref !== undefined) {
        const n = String(node.properties.ariaLabel ?? '').match(/\d+(?:-\d+)?$/)?.[0];
        if (n) node.properties.ariaLabel = `返回正文第 ${n} 处引用`;
      }
      for (const [i, child] of (node.children ?? []).entries()) visit(child, node, i);
    };
    visit(tree, null, 0);
  };
}
