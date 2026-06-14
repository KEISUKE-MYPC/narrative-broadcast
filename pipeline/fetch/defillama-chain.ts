import type { AssetConfig, OnchainData, OnchainMetric, SourceNote } from '../types';

// 金額整形：$X.XXB / $X.XM / $1,234
function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

type TvlPoint = { date: number; tvl: number };
type Overview = { total24h?: number };

// 3ソースの生データ（取得失敗分は null）からラベル付きメトリクスを組む。取れたものだけ積む。
export function parseDefiLlamaChain(
  tvl: TvlPoint[] | null,
  dex: Overview | null,
  fees: Overview | null,
  asof: string,
): OnchainData {
  const metrics: OnchainMetric[] = [];
  if (Array.isArray(tvl) && tvl.length) {
    const last = tvl[tvl.length - 1];
    if (typeof last?.tvl === 'number') metrics.push({ label: 'チェーンTVL', value: fmtUsd(last.tvl) });
  }
  if (dex && typeof dex.total24h === 'number') metrics.push({ label: 'DEX出来高(24h)', value: fmtUsd(dex.total24h) });
  if (fees && typeof fees.total24h === 'number') metrics.push({ label: '手数料(24h)', value: fmtUsd(fees.total24h) });
  return { asof: metrics.length ? asof : null, metrics };
}

export async function fetchDefiLlamaChain(cfg: AssetConfig, notes: SourceNote[]): Promise<OnchainData> {
  const chain = cfg.defillamaChain;
  if (!chain) return { asof: null, metrics: [] };
  const slug = chain.toLowerCase();
  const asof = new Date().toISOString().slice(0, 10);
  const getJson = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  };
  let tvl: TvlPoint[] | null = null;
  let dex: Overview | null = null;
  let fees: Overview | null = null;
  try { tvl = await getJson(`https://api.llama.fi/v2/historicalChainTvl/${chain}`); }
  catch (e) { notes.push({ source: 'DefiLlama-chain', message: `tvl: ${(e as Error).message}` }); }
  try { dex = await getJson(`https://api.llama.fi/overview/dexs/${slug}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`); }
  catch (e) { notes.push({ source: 'DefiLlama-chain', message: `dex: ${(e as Error).message}` }); }
  try { fees = await getJson(`https://api.llama.fi/overview/fees/${slug}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`); }
  catch (e) { notes.push({ source: 'DefiLlama-chain', message: `fees: ${(e as Error).message}` }); }
  return parseDefiLlamaChain(tvl, dex, fees, asof);
}
