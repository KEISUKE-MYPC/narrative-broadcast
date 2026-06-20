import { describe, it, expect } from 'vitest';
import { buildWeeklyTable } from './weekly-data-table';
import type { WeekData } from './collect-week';

const wa = (datetime: string, strength: number, price: string, trend: string) => ({
  slug: 's', asset: 'btc', datetime, title: 't', strength,
  dashboard: { '価格': price, 'トレンド語': trend },
});

const week: WeekData = {
  weekStart: '2026-06-15', weekEnd: '2026-06-21',
  assets: [{
    asset: 'btc', count: 2,
    first: wa('2026-06-15 06:00', 2, '$60,000', 'fed、fomc'),
    last: wa('2026-06-20 12:00', 4, '$66,000', 'fed、etf'),
  }],
  missing: ['eth', 'xrp', 'sol'],
  compositeStrength: 4,
};

describe('buildWeeklyTable', () => {
  it('銘柄ごとにW/W差分行を出す', () => {
    const md = buildWeeklyTable(week);
    expect(md).toContain('## 週間計器盤（W/W）');
    expect(md).toContain('BTC');
    expect(md).toContain('2→4'); // 強度W/W
    expect(md).toContain('+10.00%'); // 価格W/W (60000→66000)
  });

  it('記事欠落銘柄を注記する', () => {
    const md = buildWeeklyTable(week);
    expect(md).toContain('ETH');
    expect(md).toContain('記事なし');
  });
});
