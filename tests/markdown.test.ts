import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../lib/markdown';

describe('renderMarkdown', () => {
  it('GFMの表を<table>に変換する', async () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    const html = await renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });
  it('見出しと引用を変換する（rehype-slugで見出しにidが付く）', async () => {
    const html = await renderMarkdown('# 見出し\n\n> 注記');
    expect(html).toContain('<h1 id="見出し">見出し</h1>');
    expect(html).toContain('<blockquote>');
  });
  it('冒頭の「⚠️ 自動生成」バナーを除去する（通常の引用は残す）', async () => {
    const md = '> ⚠️ 自動生成｜6ソース\n\n## 見出し\n\n> 普通の注記';
    const html = await renderMarkdown(md);
    expect(html).not.toContain('自動生成');
    expect(html).toContain('<h2 id="見出し">見出し</h2>');
    expect(html).toContain('普通の注記');
  });
});
