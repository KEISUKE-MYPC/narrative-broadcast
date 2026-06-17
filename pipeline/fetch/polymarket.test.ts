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

  // 実APIは outcomePrices をJSON文字列で、タイトルを「↑ 100,000」形式で返す（旧fixtureは配列）。
  // 文字列をJSON.parseせず[0]を取ると'['→NaNになるバグの回帰テスト。
  it('parses live format: JSON-string outcomePrices and arrow titles (no NaN)', () => {
    const live = {
      events: [{
        slug: 'what-price-will-bitcoin-hit-before-2027',
        markets: [
          { groupItemTitle: '↑ 100,000', outcomePrices: '["0.155","0.845"]' },
          { groupItemTitle: '↓ 45,000', outcomePrices: '["0.395","0.605"]' },
        ],
      }],
    };
    const odds = parsePolymarket(live, btcConfig);
    expect(odds.targets['100000']).toBeCloseTo(15.5, 1);
    expect(odds.targets['45000']).toBeCloseTo(39.5, 1);
    expect(Number.isNaN(odds.targets['100000'])).toBe(false);
  });
});
