import { describe, it, expect } from 'vitest';
import { buildDataTable, appendDataTable } from './data-table';
import { btcConfig } from './config/btc';
import { solConfig } from './config/sol';
import type { FetchBundle } from './types';

const bundle: FetchBundle = {
  market: { price_usd: 65843, chg_24h: 0.5, chg_7d: 2.1, chg_30d: -10.2,
    ath: 126080, ath_change_pct: -47.78, ath_date: '2025-10-06', btc_dominance: 56.28,
    total_mcap_chg_24h: 0.4, sectors_top: [{ name: 'bStocks', chg24h: 119 }] },
  onchain: { asof: '2026-06-17', metrics: [{ label: 'MVRV-Z', value: 0.444 }, { label: 'SOPR', value: 0.9949 }] },
  trends: [{ word: 'Polymarket', score: 900 }, { word: 'SpaceX', score: 700 }],
  positions: { funding: [{ symbol: 'BTCUSDT_PERP', pct: -0.0012 }], oi_usd: 6.77e9, ls_long_pct: 59.1 },
  odds: { targets: { '55000': 54.5 }, market_slug: 'x' },
  stables: { total_usd: 313.1e9, wow_change_pct: -0.06 },
  notes: [],
};

describe('buildDataTable', () => {
  it('renders a markdown table with 指標/実測値/ソース header', () => {
    const t = buildDataTable(bundle, btcConfig);
    expect(t).toContain('## 実データ計器盤（出典）');
    expect(t).toContain('| 指標 | 実測値 | ソース |');
  });

  it('attributes each metric to its real source', () => {
    const t = buildDataTable(bundle, btcConfig);
    expect(t).toMatch(/\| 価格 \|.*\| CoinGecko \|/);
    expect(t).toMatch(/\| MVRV-Z \|.*\| bitcoin-data\.com \|/); // BTCはbitcoin-data.com
    expect(t).toMatch(/\| 建玉\(OI\) \| \$6\.77B \| Coinalyze \|/);
    expect(t).toMatch(/\| ステーブル総供給 \|.*\| DefiLlama \|/);
    expect(t).toMatch(/\| トレンド語 \|.*\| Santiment \|/);
  });

  it('switches onchain source label per asset (SOL=DefiLlama)', () => {
    const t = buildDataTable({ ...bundle, onchain: { asof: '2026-06-17', metrics: [{ label: 'チェーンTVL', value: '$4.9B' }] } }, solConfig);
    expect(t).toMatch(/\| チェーンTVL \|.*\| DefiLlama \|/);
  });

  it('returns empty string when no data', () => {
    const empty: FetchBundle = { market: null, onchain: null, trends: null, positions: null, odds: null, stables: null, notes: [] };
    expect(buildDataTable(empty, btcConfig)).toBe('');
  });
});

describe('appendDataTable', () => {
  const table = '## 実データ計器盤（出典）\n| x |';
  const DISC = '※本記事は情報提供を目的としたものであり、投資助言ではありません。';

  it('inserts the table immediately before the disclaimer', () => {
    const article = `# T\n\n本文。\n\n${DISC}`;
    const out = appendDataTable(article, table);
    expect(out.indexOf(table)).toBeLessThan(out.indexOf(DISC)); // テーブルが免責より前
    expect(out.indexOf(table)).toBeGreaterThan(out.indexOf('本文。')); // 本文より後
  });

  it('appends to the end when no disclaimer present', () => {
    const out = appendDataTable('# T\n本文。', table);
    expect(out.trimEnd().endsWith('| x |')).toBe(true);
  });

  it('is a no-op when table is empty', () => {
    expect(appendDataTable('# T\n本文。', '')).toBe('# T\n本文。');
  });
});
