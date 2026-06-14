import { describe, it, expect } from 'vitest';
import { xrpConfig } from './xrp';

describe('xrpConfig', () => {
  it('XRP識別子・CoinMetrics経路・基準ATHを持つ', () => {
    expect(xrpConfig.key).toBe('xrp');
    expect(xrpConfig.coingeckoId).toBe('ripple');
    expect(xrpConfig.onchainSource).toBe('coinmetrics');
    expect(xrpConfig.coinmetricsAsset).toBe('xrp');
    expect(xrpConfig.baselineAth).toBe(3.65);
    expect(xrpConfig.coinalyzeSymbols).toContain('XRP');
  });
});
