import { describe, it, expect } from 'vitest';
import { btcConfig } from './btc';

describe('btcConfig', () => {
  it('has BTC identifiers and baseline', () => {
    expect(btcConfig.key).toBe('btc');
    expect(btcConfig.coingeckoId).toBe('bitcoin');
    expect(btcConfig.glassnodeAsset).toBe('BTC');
    expect(btcConfig.baselineAth).toBe(126080);
    expect(btcConfig.oddsTargets).toContain('55000');
  });
});
