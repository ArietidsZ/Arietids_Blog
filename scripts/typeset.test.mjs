import assert from 'node:assert/strict';
import test from 'node:test';
import { breakable, segments } from '../src/lib/typeset.ts';

/** A title as its phrases: `|` where a line may break, `[...]` around a part that never breaks. */
const shape = (title) =>
  segments(title)
    .map((s) => (s.kind === 'wbr' ? '|' : s.kind === 'nobr' ? `[${s.text}]` : s.text))
    .join('');

test('Chinese titles break between phrases, never inside a word', () => {
  assert.equal(shape('注意力机制的三种读法'), '注意力|机制的|三种读法');
  assert.equal(shape('线性代数里的不变量'), '线性代数里的|不变量');
  // A lone character joins the word after it; 的 closes the phrase before it.
  assert.equal(shape('从视觉-语言-动作模型看具身智能的效率边界'), '[从视觉-语言-动作]|模型|看具身智能的|效率|边界');
});

test('numbers keep their measure word, and brackets their name', () => {
  assert.equal(shape('2026 年具身智能论文阅读清单'), '2026 年|具身智能|论文|阅读|清单');
  assert.equal(shape('读《深度学习》第 3 章'), '读《深度学习》|第 3 章');
});

test('punctuation never starts a line, and the double dash stays whole', () => {
  assert.equal(shape('用 Astro 搭建「静态」博客：从零到一'), '用 Astro 搭建|「静态」|博客：|从零到一');
  assert.ok(shape('线性代数中的那些不变量——从翻棋游戏谈起').includes('|——|'));
});

test('Latin titles keep hyphenated compounds whole and are otherwise untouched', () => {
  assert.equal(shape('The Efficiency Frontier of Vision-Language-Action Models'), 'The Efficiency Frontier of [Vision-Language-Action] Models');
  assert.equal(breakable('Plain title'), 'Plain title');
});

test('rendering adds only invisible hints: every visible character is kept in order', () => {
  for (const title of ['从视觉-语言-动作模型看具身智能的效率边界', '为什么 GPU 显存总是不够用？', 'CUDA 11.8 与 PyTorch 2.1 的兼容性']) {
    assert.equal(breakable(title).replace(/​/g, '').replace(/ /g, ' '), title);
  }
});
