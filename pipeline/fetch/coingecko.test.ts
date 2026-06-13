import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCoinGecko } from './coingecko';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/coingecko.json'), 'utf8'),
);

describe('parseCoinGecko', () => {
  it('extracts market fields and top-5 sectors', () => {
    const m = parseCoinGecko(raw.coin, raw.global, raw.categories);
    expect(m.price_usd).toBe(63631);
    expect(m.btc_dominance).toBe(56.39);
    expect(m.ath).toBe(126080);
    expect(m.sectors_top).toHaveLength(5);
    expect(m.sectors_top[0].name).toBe('ERC 404');
  });
});
