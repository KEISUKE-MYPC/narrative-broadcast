import { describe, it, expect } from 'vitest';
import { solConfig } from './sol';

describe('solConfig', () => {
  it('SOL識別子・defillama-chain経路・基準ATHを持つ', () => {
    expect(solConfig.key).toBe('sol');
    expect(solConfig.coingeckoId).toBe('solana');
    expect(solConfig.onchainSource).toBe('defillama-chain');
    expect(solConfig.defillamaChain).toBe('Solana');
    expect(solConfig.baselineAth).toBe(293.31);
    expect(solConfig.coinalyzeSymbols).toContain('SOL');
  });
});
