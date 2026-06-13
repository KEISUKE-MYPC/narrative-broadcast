import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBitcoinDataMetric } from './bitcoindata';

const f = (n: string) =>
  JSON.parse(readFileSync(join(__dirname, `../__fixtures__/${n}`), 'utf8'));

describe('parseBitcoinDataMetric', () => {
  it('extracts the numeric field and its date', () => {
    const p = parseBitcoinDataMetric(f('bitcoindata_mvrv.json'), 'mvrvZscore');
    expect(p.value).toBe(0.3512);
    expect(p.asof).toBe('2026-06-12');
  });
  it('returns null when the field is missing or non-numeric', () => {
    expect(parseBitcoinDataMetric({ d: 'x' }, 'sopr').value).toBeNull();
    expect(parseBitcoinDataMetric({}, 'mvrvZscore').asof).toBeNull();
  });
});
