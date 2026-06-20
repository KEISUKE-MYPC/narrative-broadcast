import { describe, it, expect } from 'vitest';
import { buildWeeklyPrompt } from './build-weekly-prompt';
import type { WeekData } from './collect-week';

const wa = (datetime: string, strength: number, title: string) => ({
  slug: 's', asset: 'btc', datetime, title, strength, dashboard: { '価格': '$64,000' },
});

const week: WeekData = {
  weekStart: '2026-06-15', weekEnd: '2026-06-21',
  assets: [{
    asset: 'btc', count: 3,
    first: wa('2026-06-15 06:00', 2, 'BTCはマクロに同化'),
    last: wa('2026-06-20 12:00', 4, 'BTCに自律性が戻りつつある'),
  }],
  missing: ['eth', 'xrp', 'sol'],
  compositeStrength: 4,
};

describe('buildWeeklyPrompt', () => {
  it('合成強度・前週比指示・各銘柄の週初/週末ナラティブを含む', () => {
    const p = buildWeeklyPrompt(week, '2026-06-21 21:00');
    expect(p).toContain('合成強度');
    expect(p).toContain('4/10');
    expect(p).toContain('BTCはマクロに同化');
    expect(p).toContain('BTCに自律性が戻りつつある');
  });

  it('価格予想・売買助言の禁止を明示する', () => {
    const p = buildWeeklyPrompt(week, '2026-06-21 21:00');
    expect(p).toContain('価格予想');
    expect(p).toContain('禁止');
  });

  it('必須セクション（銘柄別ミニ表・伝染/ローテーション）を指示する', () => {
    const p = buildWeeklyPrompt(week, '2026-06-21 21:00');
    expect(p).toContain('銘柄別');
    expect(p).toContain('伝染');
  });
});
