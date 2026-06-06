import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../lib/markdown';

describe('renderMarkdown', () => {
  it('GFMの表を<table>に変換する', async () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    const html = await renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });
  it('見出しと引用を変換する', async () => {
    const html = await renderMarkdown('# 見出し\n\n> 注記');
    expect(html).toContain('<h1>見出し</h1>');
    expect(html).toContain('<blockquote>');
  });
});
