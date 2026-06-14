import type { OnchainData, SourceNote } from '../types';

export function parseBitcoinDataMetric(
  raw: any, field: string,
): { value: number | null; asof: string | null } {
  const v = raw?.[field];
  if (typeof v !== 'number') return { value: null, asof: null };
  return { value: v, asof: typeof raw?.d === 'string' ? raw.d : null };
}

const METRICS: { key: 'mvrv_z' | 'sopr'; path: string; field: string }[] = [
  { key: 'mvrv_z', path: 'mvrv-zscore', field: 'mvrvZscore' },
  { key: 'sopr', path: 'sopr', field: 'sopr' },
];

export async function fetchOnchain(notes: SourceNote[]): Promise<OnchainData> {
  const out: OnchainData = { asof: null, metrics: [] };
  const labels: Record<string, string> = { mvrv_z: 'MVRV-Z', sopr: 'SOPR' };
  for (const m of METRICS) {
    try {
      const res = await fetch(`https://bitcoin-data.com/v1/${m.path}/last`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const parsed = parseBitcoinDataMetric(await res.json(), m.field);
      out.metrics.push({ label: labels[m.key], value: parsed.value });
      if (parsed.asof) out.asof = parsed.asof;
    } catch (e) {
      notes.push({ source: 'bitcoin-data', message: `${m.path}: ${(e as Error).message}` });
    }
  }
  return out;
}
