import type { AssetConfig } from '../types';

export const btcConfig: AssetConfig = {
  key: 'btc',
  cycle: '6h',
  coingeckoId: 'bitcoin',
  glassnodeAsset: 'BTC',
  santimentSize: 12,
  coinalyzeSymbols:
    'BTCUSDT_PERP.A,BTCUSD_PERP.A,BTC-PERPETUAL.2,BTCUSDT_PERP.4,BTCUSDT_PERP.F',
  polymarketSlug: 'what-price-will-bitcoin-hit-before-2027',
  oddsTargets: ['55000', '50000', '45000', '100000', '120000'],
  baselineAth: 126080,
  baselineAthDate: '2025-10-06',
  outputDir: 'articles',
  promptIntro:
    'BTC（ビットコイン）の6hナラティブ分析。市場参加者がBTCをどう語っているか、その語り口の変化を構造分析する。',
};
