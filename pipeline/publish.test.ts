import { describe, it, expect } from 'vitest';
import {
  buildIndexRow, articleRelPath, extractTitle, relToSlug,
  extractStrength, previousStrength, formatDelta,
} from './publish';
import { btcConfig } from './config/btc';

describe('publish helpers', () => {
  it('extractTitle reads first markdown h1', () => {
    expect(extractTitle('> ⚠️ 自動生成｜6ソース\n# 半値の語り\n本文')).toBe('半値の語り');
  });
  it('articleRelPath builds dated path with category suffix', () => {
    const p = articleRelPath(btcConfig, new Date('2026-06-13T06:06:00Z'), 'Asia/Tokyo');
    expect(p).toBe('articles/2026/06/2026-06-13-1506-6h-btc.md');
  });
  it('buildIndexRow formats a pipe row with strength and link', () => {
    const row = buildIndexRow({
      datetimeJst: '2026-06-13 15:06', cycle: '6h', title: '半値の語り',
      strength: 7, strengthDelta: '+2',
      keyData: 'BTC$63,631・BTCドミナンス56.39%', slug: '2026/06/2026-06-13-1506-6h-btc',
    });
    expect(row.startsWith('| 2026-06-13 15:06 | 6h | 半値の語り |')).toBe(true);
    expect(row).toContain('[link](2026/06/2026-06-13-1506-6h-btc.md)');
    expect(row).toContain('7/10 (+2)');
  });
  it('relToSlug strips outputDir and .md so the INDEX link has a single .md', () => {
    const slug = relToSlug('articles/2026/06/2026-06-13-1506-6h-btc.md', 'articles');
    expect(slug).toBe('2026/06/2026-06-13-1506-6h-btc');
    const row = buildIndexRow({ datetimeJst: 'x', cycle: '6h', title: 't', strength: 1, strengthDelta: '±0', keyData: 'k', slug });
    expect(row).toContain('[link](2026/06/2026-06-13-1506-6h-btc.md)');
    expect(row).not.toContain('.md.md');
  });

  it('extractStrength reads the LLM strength line (表記揺れ許容)', () => {
    expect(extractStrength('# t\n**ナラティブ強度：7/10**\n本文')).toBe(7);
    expect(extractStrength('ナラティブ強度: 3 / 10')).toBe(3);
    expect(extractStrength('強度の話はあるが指定行は無い')).toBeNull();
    expect(extractStrength('**ナラティブ強度：99/10**')).toBe(10); // 1..10にクランプ
  });

  it('previousStrength は同一銘柄の直近行の強度を返す', () => {
    const idx = [
      '| 2026-06-14 12:00 | 6h | a | 6/10 (+1) | k | [link](2026/06/x-eth.md) |',
      '| 2026-06-14 06:00 | 6h | b | 4/10 (-2) | k | [link](2026/06/y-btc.md) |',
      '| 2026-06-14 00:00 | 6h | c | 8/10 (±0) | k | [link](2026/06/z-btc.md) |',
    ].join('\n');
    expect(previousStrength(idx, 'btc')).toBe(4); // 最初に一致するbtc行
    expect(previousStrength(idx, 'eth')).toBe(6);
    expect(previousStrength(idx, 'sol')).toBeNull();
  });

  it('formatDelta は +N / -N / ±0', () => {
    expect(formatDelta(7, 5)).toBe('+2');
    expect(formatDelta(4, 6)).toBe('-2');
    expect(formatDelta(5, 5)).toBe('±0');
    expect(formatDelta(5, null)).toBe('±0');
  });
});
