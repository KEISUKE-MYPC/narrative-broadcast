import type { AssetConfig } from '../types';

export const ethConfig: AssetConfig = {
  key: 'eth',
  cycle: '6h',
  coingeckoId: 'ethereum',
  glassnodeAsset: 'ETH',
  onchainSource: 'coinmetrics',
  coinmetricsAsset: 'eth',
  santimentSize: 12,
  coinalyzeSymbols: 'ETHUSDT_PERP.A,ETHUSD_PERP.A,ETH-PERPETUAL.2,ETHUSDT_PERP.4,ETHUSDT_PERP.F',
  polymarketSlug: 'what-price-will-ethereum-hit-before-2027',
  oddsTargets: ['1000', '1500', '3000', '4000', '5000'],
  baselineAth: 4946,
  baselineAthDate: '2025-08-24',
  outputDir: 'articles',
  promptIntro: 'ETH（イーサリアム）の6hナラティブ分析。市場参加者がETHをどう語っているか、その語り口の変化を構造分析する。',
};
