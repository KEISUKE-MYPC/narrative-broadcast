import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePolymarket } from './polymarket';
import { btcConfig } from '../config/btc';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/polymarket.json'), 'utf8'),
);

describe('parsePolymarket', () => {
  it('maps target price to YES probability percent', () => {
    const odds = parsePolymarket(raw, btcConfig);
    expect(odds.targets['55000']).toBeCloseTo(54.5, 1);
    expect(odds.targets['100000']).toBeCloseTo(17.5, 1);
  });
});
