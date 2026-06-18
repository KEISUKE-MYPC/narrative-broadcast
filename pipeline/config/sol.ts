import type { AssetConfig } from '../types';

export const solConfig: AssetConfig = {
  key: 'sol',
  cycle: '6h',
  coingeckoId: 'solana',
  glassnodeAsset: 'SOL',
  onchainSource: 'defillama-chain',
  defillamaChain: 'Solana',
  santimentSize: 12,
  coinalyzeSymbols: 'SOLUSDT_PERP.A,SOLUSD_PERP.A,SOL-PERPETUAL.2,SOLUSDT_PERP.4,SOLUSDT_PERP.F',
  polymarketSlug: 'what-price-will-solana-hit-before-2027',
  oddsTargets: ['40', '60', '160', '200', '400'],
  baselineAth: 293.31,
  baselineAthDate: '2025-01-19',
  outputDir: 'articles',
  promptIntro: 'SOL（ソラナ）の6hナラティブ分析。市場参加者がSOLをどう語っているか、その語り口の変化を構造分析する。',
};
