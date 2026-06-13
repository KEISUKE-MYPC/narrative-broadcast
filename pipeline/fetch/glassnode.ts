import type { OnchainData, AssetConfig, SourceNote } from '../types';

type Point = { t: number; v: number };

export function parseGlassnodeMetric(raw: Point[]): {
  value: number | null; asof: string | null;
} {
  if (!Array.isArray(raw) || raw.length === 0) return { value: null, asof: null };
  const last = raw[raw.length - 1];
  return {
    value: last.v,
    asof: new Date(last.t * 1000).toISOString().slice(0, 10),
  };
}

const METRICS: Record<keyof Omit<OnchainData, 'asof'>, string> = {
  mvrv_z: 'market/mvrv_z_score',
  sopr: 'indicators/sopr',
  lth_sum: 'supply/lth_sum',
};

export async function fetchGlassnode(
  cfg: AssetConfig, notes: SourceNote[],
): Promise<OnchainData> {
  const key = process.env.GLASSNODE_API_KEY ?? '';
  const out: OnchainData = { mvrv_z: null, sopr: null, lth_sum: null, asof: null };
  for (const [field, path] of Object.entries(METRICS) as [keyof typeof METRICS, string][]) {
    try {
      const url = `https://api.glassnode.com/v1/metrics/${path}?a=${cfg.glassnodeAsset}&i=24h`;
      const res = await fetch(url, { headers: { 'X-Api-Key': key } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const parsed = parseGlassnodeMetric(await res.json());
      out[field] = parsed.value;
      if (parsed.asof) out.asof = parsed.asof;
    } catch (e) {
      notes.push({ source: 'Glassnode', message: `${path}: ${(e as Error).message}` });
    }
  }
  return out;
}
