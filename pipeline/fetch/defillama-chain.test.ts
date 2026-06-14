import { describe, it, expect } from 'vitest';
import { parseDefiLlamaChain } from './defillama-chain';

describe('parseDefiLlamaChain', () => {
  it('TVL/DEX出来高/手数料をラベル付きで整形', () => {
    const o = parseDefiLlamaChain(
      [{ date: 1781308800, tvl: 4500000000 }, { date: 1781395200, tvl: 4772228604 }],
      { total24h: 1005291480 },
      { total24h: 4803194 },
      '2026-06-14',
    );
    expect(o.asof).toBe('2026-06-14');
    expect(o.metrics).toEqual([
      { label: 'チェーンTVL', value: '$4.77B' },
      { label: 'DEX出来高(24h)', value: '$1.01B' },
      { label: '手数料(24h)', value: '$4.8M' },
    ]);
  });

  it('欠損ソースは省く', () => {
    const o = parseDefiLlamaChain(null, { total24h: 1005291480 }, null, '2026-06-14');
    expect(o.metrics.map((m) => m.label)).toEqual(['DEX出来高(24h)']);
  });

  it('全欠損なら asof=null・空metrics', () => {
    expect(parseDefiLlamaChain(null, null, null, '2026-06-14')).toEqual({ asof: null, metrics: [] });
  });
});
