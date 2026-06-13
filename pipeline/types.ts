// 取得失敗の記録（記事冒頭注記に使う）
export type SourceNote = { source: string; message: string };

export type MarketData = {
  price_usd: number;
  chg_24h: number; chg_7d: number; chg_30d: number;
  ath: number; ath_change_pct: number; ath_date: string;
  btc_dominance: number;
  total_mcap_chg_24h: number;
  sectors_top: { name: string; chg24h: number }[];
};

export type OnchainData = {
  mvrv_z: number | null;
  sopr: number | null;
  lth_sum: number | null;
  asof: string | null; // 最新データ点の日付(UTC)
};

export type TrendWord = { word: string; score: number };

export type PositionData = {
  funding: { symbol: string; pct: number }[]; // value*100
  oi_usd: number | null;
  ls_long_pct: number | null; // long%
};

export type OddsData = {
  // ターゲット価格→到達確率%。例 { "55000": 54.5, "100000": 17.5 }
  targets: Record<string, number>;
  market_slug: string;
};

export type StableData = {
  total_usd: number;          // 最新 totalCirculatingUSD.peggedUSD
  wow_change_pct: number | null; // 約7日前比
};

export type FetchBundle = {
  market: MarketData | null;
  onchain: OnchainData | null;
  trends: TrendWord[] | null;
  positions: PositionData | null;
  odds: OddsData | null;
  stables: StableData | null;
  notes: SourceNote[];
};

export type AssetConfig = {
  key: string;            // 'btc'（ファイル名接尾辞）
  cycle: string;          // '6h'
  coingeckoId: string;    // 'bitcoin'
  glassnodeAsset: string; // 'BTC'
  santimentSize: number;  // 12
  coinalyzeSymbols: string;
  polymarketSlug: string; // 'what-price-will-bitcoin-hit-before-2027'
  oddsTargets: string[];  // ['55000','50000','45000','100000','120000']
  baselineAth: number;    // 126080
  baselineAthDate: string;// '2025-10-06'
  outputDir: string;      // 'articles'
  promptIntro: string;    // 銘柄固有の導入（build-promptで使用）
};
