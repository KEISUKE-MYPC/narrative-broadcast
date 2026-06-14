import type { AssetConfig } from '../types';

export const xrpConfig: AssetConfig = {
  key: 'xrp',
  cycle: '6h',
  coingeckoId: 'ripple',
  glassnodeAsset: 'XRP',
  onchainSource: 'coinmetrics',
  coinmetricsAsset: 'xrp',
  santimentSize: 12,
  coinalyzeSymbols: 'XRPUSDT_PERP.A,XRPUSD_PERP.A,XRP-PERPETUAL.2,XRPUSDT_PERP.4,XRPUSDT_PERP.F',
  polymarketSlug: '',
  oddsTargets: [],
  baselineAth: 3.65,
  baselineAthDate: '2025-07-18',
  outputDir: 'articles',
  promptIntro: 'XRP（リップル）の6hナラティブ分析。市場参加者がXRPをどう語っているか、その語り口の変化を構造分析する。',
};
