import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCoinMetrics } from './coinmetrics';
const f = (n: string) => JSON.parse(readFileSync(join(__dirname, `../__fixtures__/${n}`), 'utf8'));

describe('parseCoinMetrics', () => {
  it('MVRV/活動アドレス/取引所ネットフローを抽出', () => {
    const o = parseCoinMetrics(f('coinmetrics_eth.json'));
    expect(o.asof).toBe('2026-06-13');
    const labels = o.metrics.map((m) => m.label);
    expect(labels).toContain('MVRV');
    expect(labels).toContain('活動アドレス');
    expect(labels).toContain('取引所ネットフロー');
    expect(Number(o.metrics.find((m) => m.label === 'MVRV')!.value)).toBeCloseTo(0.836, 2);
  });
  it('欠損メトリクスは省く', () => {
    const o = parseCoinMetrics({ data: [{ time: '2026-06-13T00:00:00Z', CapMVRVCur: '0.9' }] });
    expect(o.metrics.map((m) => m.label)).toEqual(['MVRV']);
  });
  it('dataが空なら空metrics', () => {
    expect(parseCoinMetrics({ data: [] }).metrics).toEqual([]);
  });
});
