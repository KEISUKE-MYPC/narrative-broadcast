import { describe, it, expect } from 'vitest';
import { buildPrompt } from './build-prompt';
import { btcConfig } from './config/btc';
import type { FetchBundle } from './types';

const bundle: FetchBundle = {
  market: { price_usd: 63631, chg_24h: 1.05, chg_7d: 2.68, chg_30d: -20.94,
    ath: 126080, ath_change_pct: -49.53, ath_date: '2025-10-06', btc_dominance: 56.39,
    total_mcap_chg_24h: 0.85, sectors_top: [{ name: 'ERC 404', chg24h: 64.8 }] },
  onchain: { asof: '2026-06-11', metrics: [{ label: 'MVRV-Z', value: 0.344 }, { label: 'SOPR', value: 0.988 }] },
  trends: [{ word: 'spacex', score: 1004 }],
  positions: { funding: [{ symbol: 'BTCUSDT_PERP.A', pct: 0.0024 }], oi_usd: 6.29e9, ls_long_pct: 60.12 },
  odds: { targets: { '55000': 54.5 }, market_slug: 'x' },
  stables: { total_usd: 313.34e9, wow_change_pct: -0.58 },
  notes: [],
};

describe('buildPrompt', () => {
  it('includes methodology guardrails, data, recent angles, and baseline', () => {
    const p = buildPrompt(bundle, ['前回の切り口A'], btcConfig, '2026-06-13 15:06');
    expect(p).toContain('価格予想');
    expect(p).toContain('126080');
    expect(p).toContain('63631');
    expect(p).toContain('spacex');
    expect(p).toContain('前回の切り口A');
    expect(p).toContain('⚠️ 自動生成｜6ソース');
    expect(p).toContain('$6.29B'); // OIはB単位整形（生数値でnemotronが桁を読み違えるのを防ぐ）
  });

  it('includes the plain-style guardrail prohibiting coinage and layered metaphor', () => {
    const p = buildPrompt(bundle, [], btcConfig, '2026-06-13 15:06');
    expect(p).toContain('一文一義');
    expect(p).toContain('独自の造語・多層的な比喩・カタカナ英語の直訳は禁止');
  });

  it('embeds the gold-sample excerpt as a craft checklist with a no-copy instruction', () => {
    const p = buildPrompt(bundle, [], btcConfig, '2026-06-13 15:06');
    expect(p).toContain('文体の手本');
    expect(p).toContain('リードで主張を1行で言い切る'); // 書き方チェックリスト
    expect(p).toContain('一切流用しない'); // 丸写し禁止の厳守ルール
    expect(p).toContain('【本文の書き方例】'); // 縮小版の抜粋が入っている
  });

  it('lists source failures when notes present', () => {
    const p = buildPrompt({ ...bundle, notes: [{ source: 'Coinalyze', message: 'oi: 500' }] },
      [], btcConfig, '2026-06-13 15:06');
    expect(p).toContain('取得失敗');
    expect(p).toContain('Coinalyze');
  });
});
