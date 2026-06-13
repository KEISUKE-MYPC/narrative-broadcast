import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFunding, parseLongShort, parseOpenInterest } from './coinalyze';

const f = (n: string) =>
  JSON.parse(readFileSync(join(__dirname, `../__fixtures__/${n}`), 'utf8'));

describe('parseFunding', () => {
  it('keeps value as-is (already a percent)', () => {
    const out = parseFunding(f('coinalyze_funding.json'));
    expect(out[0].symbol).toBe('BTCUSDT_PERP.A');
    expect(out[0].pct).toBeCloseTo(0.005357, 6);
  });
});

describe('parseLongShort', () => {
  it('returns latest long%', () => {
    expect(parseLongShort(f('coinalyze_ls.json'))).toBe(60.12);
  });
});

describe('parseOpenInterest', () => {
  it('returns the primary venue OI (not the sum)', () => {
    expect(parseOpenInterest(f('coinalyze_oi.json'), 'BTCUSDT_PERP.A')).toBe(6252933884);
  });
  it('returns null for empty', () => {
    expect(parseOpenInterest([], 'BTCUSDT_PERP.A')).toBeNull();
  });
});
