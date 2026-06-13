import type { TrendWord, AssetConfig } from '../types';

type Raw = { data?: { getTrendingWords?: { datetime: string; topWords: TrendWord[] }[] } };

export function parseSantiment(raw: Raw): TrendWord[] {
  const buckets = raw.data?.getTrendingWords ?? [];
  if (buckets.length === 0) return [];
  const latest = buckets[buckets.length - 1];
  return [...latest.topWords].sort((a, b) => b.score - a.score);
}

export async function fetchSantiment(cfg: AssetConfig): Promise<TrendWord[]> {
  const key = process.env.SANTIMENT_API_KEY;
  if (!key) throw new Error('SANTIMENT_API_KEY missing');
  const query = `{ getTrendingWords(size:${cfg.santimentSize}, from:"utc_now-2d", to:"utc_now", interval:"1d"){ datetime topWords{ word score } } }`;
  const res = await fetch('https://api.santiment.net/graphql', {
    method: 'POST',
    headers: { Authorization: `Apikey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Santiment -> ${res.status}`);
  return parseSantiment(await res.json());
}
