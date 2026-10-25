/**
 * Line breaking for titles. Chinese has no spaces, so a browser may break a heading between any
 * two characters, splitting words such as 效率 or 边界 across lines. Titles are therefore set with
 * `word-break: keep-all` (no breaks inside a run of letters) and given break opportunities only
 * between phrases, found at build time by the ICU word segmenter:
 *
 *  - a lone character joins the word after it (从|视觉 → 从视觉), except particles such as 的 and
 *    了, which close the phrase before them, and a character left at the end, which joins the last;
 *  - punctuation stays with the text before it and opening marks with the text after, so no line
 *    starts or ends on the wrong side of a mark;
 *  - Latin runs, numbers with their measure word (2026 年) and hyphenated compounds
 *    (视觉-语言-动作, Vision-Language-Action) hold together; the CJK double dash stays whole.
 *
 * Rendering only: the visible text keeps every character, plus zero-width spaces that screen
 * readers skip and the copy handler removes (and a no-break space inside "2026 年").
 */

export type Script = 'han' | 'latin';
export type Segment = { text: string; kind: 'text' | 'nobr' | 'wbr' };

const HAN = /\p{Script=Han}/u;
const LONE_HAN = /^\p{Script=Han}$/u;
/** Particles that close the phrase before them. */
const CLOSES = /^[的地得了着过们吗呢吧啊么之]$/u;
/** Measure words that belong to the number before them. */
const UNITS = /^[年月日号个篇次章节岁天周届期]$/u;
/** Punctuation and closing marks, which must not begin a line. */
const TRAILING = /^[\p{Pe}\p{Pf}\p{Po}]+$/u;
/** Opening marks, which must not end a line. */
const LEADING = /^[\p{Ps}\p{Pi}]+$/u;
const HYPHEN = /^[-‐]$/u;
const DASH = /^\p{Pd}+$/u;
/** A hyphenated Latin compound in a Latin title. */
const COMPOUND = /[A-Za-z0-9]+(?:[-‐][A-Za-z0-9]+)+/g;

export function script(text: string): Script {
  return HAN.test(text) ? 'han' : 'latin';
}

let segmenter: Intl.Segmenter | undefined;
const words = (text: string) => [...(segmenter ??= new Intl.Segmenter('zh', { granularity: 'word' })).segment(text)].map((s) => s.segment);

/** Phrases of a Han title; break opportunities fall between them. */
export function phrases(text: string): string[] {
  const out: string[] = [];
  let carry = '';
  let glue = false;
  const open = () => out.length > 0 && !/\s$/.test(out.at(-1)!);
  const append = (s: string) => (out[out.length - 1] += s);
  for (const w of words(text)) {
    const last = out.at(-1) ?? '';
    if (/^\s+$/.test(w)) {
      if (carry) out.push(carry), (carry = '');
      out.push(w);
      glue = false;
    } else if (glue) {
      // The word after a hyphen joins its compound.
      append(carry + w);
      carry = '';
      glue = false;
    } else if (HYPHEN.test(w) && !carry && /[\p{L}\p{N}]$/u.test(last)) {
      append(w);
      glue = true;
    } else if (UNITS.test(w) && !carry && out.length >= 2 && last === ' ' && /\d$/.test(out.at(-2)!)) {
      out.splice(-2, 2, `${out.at(-2)} ${w}`);
    } else if (DASH.test(w) && !carry && last.endsWith(w[0]!)) {
      append(w);
    } else if (LONE_HAN.test(w) && CLOSES.test(w) && open()) {
      append(carry + w);
      carry = '';
    } else if (TRAILING.test(w) && !LEADING.test(w)) {
      if (carry) out.push(carry + w), (carry = '');
      else if (open()) append(w);
      else out.push(w);
    } else if (!HAN.test(w) && !carry && open() && !HAN.test(last.at(-1)!)) {
      // Latin letters, digits and symbols with no space between them are one run.
      append(w);
    } else if (LONE_HAN.test(w) || LEADING.test(w)) {
      carry += w;
    } else {
      out.push(carry + w);
      carry = '';
    }
  }
  // A single character left over joins the last phrase; a longer tail is a phrase of its own.
  if (carry) [...carry].length === 1 && open() ? append(carry) : out.push(carry);
  return brackets(out);
}

const PAIRS: Record<string, string> = { '《': '》', '「': '」', '『': '』', '“': '”', '（': '）', '(': ')' };

/** A short bracketed name (《深度学习》, 「静态」) is never broken inside its brackets. */
function brackets(list: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < list.length; i++) {
    let p = list[i]!;
    const opener = [...p].findLast((c) => c in PAIRS);
    if (opener && !p.slice(p.lastIndexOf(opener)).includes(PAIRS[opener]!)) {
      let j = i + 1;
      let joined = p;
      while (j < list.length && !joined.slice(joined.lastIndexOf(opener)).includes(PAIRS[opener]!)) joined += list[j++]!;
      if ([...joined.slice(joined.lastIndexOf(opener))].length <= 14) {
        p = joined;
        i = j - 1;
      }
    }
    out.push(p);
  }
  return out;
}

/** Split a title into runs, unbreakable compounds and break hints. */
export function segments(text: string): Segment[] {
  if (!HAN.test(text)) {
    const out: Segment[] = [];
    let last = 0;
    for (const m of text.matchAll(COMPOUND)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index), kind: 'text' });
      out.push({ text: m[0], kind: 'nobr' });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), kind: 'text' });
    return out;
  }
  const out: Segment[] = [];
  for (const p of phrases(text)) {
    const space = /^\s+$/.test(p);
    // No hint is needed beside a space, which is already a break opportunity.
    if (out.length && !space && out.at(-1)!.kind !== 'wbr' && !/\s$/.test(out.at(-1)!.text)) out.push({ text: '', kind: 'wbr' });
    out.push({ text: p, kind: /[\p{L}\p{N}][-‐][\p{L}\p{N}]/u.test(p) ? 'nobr' : 'text' });
  }
  return out;
}

/** The plain string a title renders as: phrases joined by zero-width spaces. */
export function breakable(text: string): string {
  return segments(text)
    .map((s) => (s.kind === 'wbr' ? '​' : s.text))
    .join('');
}
