import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePolymarket } from './polymarket';
import { btcConfig } from '../config/btc';
import { xrpConfig } from '../config/xrp';

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

  it('keeps decimal price targets (XRP) and skips already-hit 100% / duplicate ↑↓ keys', () => {
    const live = {
      events: [{
        slug: 'what-price-will-xrp-hit-before-2027',
        markets: [
          { groupItemTitle: '↑ 3.00', outcomePrices: '["0.10","0.90"]' },   // 小数キー
          { groupItemTitle: '↓ 0.80', outcomePrices: '["0.68","0.32"]' },
          { groupItemTitle: '↓ 1.20', outcomePrices: '["1","0"]' },          // 到達済み100%→除外（targetでもない）
          { groupItemTitle: '↑ 0.80', outcomePrices: '["1","0"]' },          // 0.80の重複(↑/↓)・100%側→除外
        ],
      }],
    };
    const odds = parsePolymarket(live, xrpConfig);
    expect(odds.targets['3.00']).toBeCloseTo(10, 1); // ドット保持でマッチ
    expect(odds.targets['0.80']).toBeCloseTo(68, 1); // 意味のある↓側が残り、100%の↑側は除外
  });
});
