import { describe, it, expect } from 'vitest';
import { summarizeKeyData } from './run';
import { btcConfig } from './config/btc';
import { ethConfig } from './config/eth';
import type { FetchBundle } from './types';

const bundle = {
  market: { price_usd: 63631, ath_change_pct: -49.531, btc_dominance: 56.394 },
  onchain: { asof: null, metrics: [{ label: 'MVRV-Z', value: 0.344 }] },
} as unknown as FetchBundle;

describe('summarizeKeyData', () => {
  it('銘柄ティッカー接頭辞＋%は2桁丸め', () => {
    const s = summarizeKeyData(bundle, btcConfig);
    expect(s).toContain('BTC$63,631');
    expect(s).toContain('ATH-49.53%');
    expect(s).toContain('BTCドミナンス56.39%');
  });
  it('銘柄ごとにティッカーが変わる(旧BTC$固定のバグ修正)', () => {
    expect(summarizeKeyData(bundle, ethConfig)).toContain('ETH$63,631');
  });
});
