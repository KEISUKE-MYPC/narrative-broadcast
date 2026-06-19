import { describe, it, expect } from 'vitest';
import {
  weekStartJst, parseJstDatetime, parseDashboard, extractPrice,
  selectWeekArticles, collectWeek,
} from './collect-week';
import type { IndexRow } from '../../lib/index-parser';

const dash = (price: string, trend: string) => `# タイトル
**ナラティブ強度：3/10**
本文。

## 実データ計器盤（出典）

| 指標 | 実測値 | ソース |
|---|---|---|
| 価格 | ${price} | CoinGecko |
| トレンド語 | ${trend} | Santiment |

※本記事は情報提供を目的としたものであり、投資助言ではありません。
`;

const row = (datetime: string, slug: string, strength: number): IndexRow => ({
  datetime, cycle: '6h', narrative: 'n', strength, strengthDelta: '±0',
  keyData: 'k', slug,
});

describe('weekStartJst', () => {
  it('日曜の now からその週の月曜00:00 JST を返す', () => {
    // 2026-06-21 は日曜。21:00 JST = 12:00 UTC。
    const now = new Date('2026-06-21T12:00:00Z');
    const mon = weekStartJst(now);
    // 月曜 2026-06-15 00:00 JST = 2026-06-14 15:00 UTC
    expect(mon.toISOString()).toBe('2026-06-14T15:00:00.000Z');
  });
});

describe('parseJstDatetime', () => {
  it('JST文字列をUTC Dateに変換する', () => {
    expect(parseJstDatetime('2026-06-15 00:00').toISOString()).toBe('2026-06-14T15:00:00.000Z');
  });
});

describe('parseDashboard / extractPrice', () => {
  it('計器盤をラベル→値に分解し価格を数値化する', () => {
    const d = parseDashboard(dash('$64,338（24h -2.74% / 7d 11.03% / 30d -15.66%）', 'fed、fomc'));
    expect(d['価格']).toContain('$64,338');
    expect(d['トレンド語']).toBe('fed、fomc');
    expect(extractPrice(d['価格'])).toBe(64338);
  });
});

describe('selectWeekArticles', () => {
  it('今週かつ銘柄記事だけを選ぶ（先週・weeklyは除外）', () => {
    const now = new Date('2026-06-21T12:00:00Z'); // 週=6/15〜
    const rows = [
      row('2026-06-20 12:00', '2026/06/2026-06-20-1200-6h-btc', 4),
      row('2026-06-14 12:00', '2026/06/2026-06-14-1200-6h-btc', 9), // 先週→除外
      row('2026-06-21 00:00', '2026/06/2026-06-21-0000-7d-weekly', 5), // weekly→除外
    ];
    const sel = selectWeekArticles(rows, now);
    expect(sel.map((r) => r.slug)).toEqual(['2026/06/2026-06-20-1200-6h-btc']);
  });
});

describe('collectWeek', () => {
  it('銘柄ごとに週初/週末を取り、合成強度を平均で出す', () => {
    const now = new Date('2026-06-21T12:00:00Z');
    const rows = [
      row('2026-06-20 12:00', '2026/06/2026-06-20-1200-6h-btc', 4), // BTC 週末
      row('2026-06-16 06:00', '2026/06/2026-06-16-0600-6h-btc', 2), // BTC 週初
      row('2026-06-19 18:00', '2026/06/2026-06-19-1800-6h-eth', 6), // ETH 1本のみ
    ];
    const getArticle = (slug: string) =>
      slug.endsWith('-btc') || slug.includes('-btc') ? dash('$64,000', 'fed') : dash('$1,700', 'eth');
    const wk = collectWeek(now, { rows, getArticle });
    expect(wk.weekStart).toBe('2026-06-15');
    const btc = wk.assets.find((a) => a.asset === 'btc')!;
    expect(btc.first.strength).toBe(2);
    expect(btc.last.strength).toBe(4);
    expect(btc.count).toBe(2);
    expect(wk.missing.sort()).toEqual(['sol', 'xrp']);
    // 合成強度＝(BTC4 + ETH6)/2 = 5
    expect(wk.compositeStrength).toBe(5);
  });
});
