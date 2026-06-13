import { describe, it, expect } from 'vitest';
import { buildIndexRow, articleRelPath, extractTitle, relToSlug } from './publish';
import { btcConfig } from './config/btc';

describe('publish helpers', () => {
  it('extractTitle reads first markdown h1', () => {
    expect(extractTitle('> ⚠️ 自動生成｜6ソース\n# 半値の語り\n本文')).toBe('半値の語り');
  });
  it('articleRelPath builds dated path with category suffix', () => {
    const p = articleRelPath(btcConfig, new Date('2026-06-13T06:06:00Z'), 'Asia/Tokyo');
    expect(p).toBe('articles/2026/06/2026-06-13-1506-6h-btc.md');
  });
  it('buildIndexRow formats a pipe row with link', () => {
    const row = buildIndexRow({
      datetimeJst: '2026-06-13 15:06', cycle: '6h', title: '半値の語り',
      keyData: 'BTC$63,631・ドミナンス56.39%', slug: '2026/06/2026-06-13-1506-6h-btc',
    });
    expect(row.startsWith('| 2026-06-13 15:06 | 6h | 半値の語り |')).toBe(true);
    expect(row).toContain('[link](2026/06/2026-06-13-1506-6h-btc.md)');
    expect(row).toContain('1/10');
  });
  it('relToSlug strips outputDir and .md so the INDEX link has a single .md', () => {
    const slug = relToSlug('articles/2026/06/2026-06-13-1506-6h-btc.md', 'articles');
    expect(slug).toBe('2026/06/2026-06-13-1506-6h-btc');
    const row = buildIndexRow({ datetimeJst: 'x', cycle: '6h', title: 't', keyData: 'k', slug });
    expect(row).toContain('[link](2026/06/2026-06-13-1506-6h-btc.md)');
    expect(row).not.toContain('.md.md');
  });
});
