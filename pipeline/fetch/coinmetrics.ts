import type { OnchainData, AssetConfig, SourceNote } from '../types';

// Coin Metrics Community のレスポンスの最新レコードから OnchainData を組み立てる純粋関数。
export function parseCoinMetrics(raw: any): OnchainData {
  const rows = Array.isArray(raw?.data) ? raw.data : [];
  const last = rows[rows.length - 1];
  if (!last) return { asof: null, metrics: [] };
  const num = (v: any) => (v == null || v === '' ? null : Number(v));
  const metrics: OnchainData['metrics'] = [];
  const mvrv = num(last.CapMVRVCur);
  if (mvrv != null) metrics.push({ label: 'MVRV', value: Math.round(mvrv * 1000) / 1000 });
  const act = num(last.AdrActCnt);
  if (act != null) metrics.push({ label: '活動アドレス', value: act });
  const fin = num(last.FlowInExUSD), fout = num(last.FlowOutExUSD);
  if (fin != null && fout != null) metrics.push({ label: '取引所ネットフロー', value: `$${Math.round((fin - fout) / 1e6)}M` });
  const asof = typeof last.time === 'string' ? last.time.slice(0, 10) : null;
  return { asof, metrics };
}

export async function fetchCoinMetricsOnchain(cfg: AssetConfig, notes: SourceNote[]): Promise<OnchainData> {
  const a = cfg.coinmetricsAsset;
  if (!a) return { asof: null, metrics: [] };
  const base = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
  const mets = 'CapMVRVCur,AdrActCnt,FlowInExUSD,FlowOutExUSD';
  try {
    const end = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${base}?assets=${a}&metrics=${mets}&frequency=1d&page_size=1&end_time=${end}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return parseCoinMetrics(await res.json());
  } catch (e) {
    notes.push({ source: 'CoinMetrics', message: (e as Error).message });
    return { asof: null, metrics: [] };
  }
}
