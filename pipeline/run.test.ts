import { describe, it, expect } from 'vitest';
import { summarizeKeyData } from './run';
import type { FetchBundle } from './types';

const bundle = {
  market: { price_usd: 63631, ath_change_pct: -49.53, btc_dominance: 56.39 },
  onchain: { asof: null, metrics: [{ label: 'MVRV-Z', value: 0.344 }] },
} as unknown as FetchBundle;

describe('summarizeKeyData', () => {
  it('produces a compact key-data string', () => {
    const s = summarizeKeyData(bundle);
    expect(s).toContain('$63,631');
    expect(s).toContain('56.39%');
  });
});
