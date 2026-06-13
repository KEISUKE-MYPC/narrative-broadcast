import type { StableData } from '../types';

type Point = { date: string; totalCirculatingUSD: { peggedUSD: number } };

export function parseDefiLlama(raw: Point[]): StableData {
  if (!Array.isArray(raw) || raw.length === 0) return { total_usd: 0, wow_change_pct: null };
  const latest = raw[raw.length - 1].totalCirculatingUSD.peggedUSD;
  if (raw.length < 8) return { total_usd: latest, wow_change_pct: null };
  const prev = raw[raw.length - 8].totalCirculatingUSD.peggedUSD;
  const wow = prev ? ((latest - prev) / prev) * 100 : null;
  return { total_usd: latest, wow_change_pct: wow };
}

export async function fetchDefiLlama(): Promise<StableData> {
  const res = await fetch('https://stablecoins.llama.fi/stablecoincharts/all');
  if (!res.ok) throw new Error(`DefiLlama -> ${res.status}`);
  return parseDefiLlama(await res.json());
}
