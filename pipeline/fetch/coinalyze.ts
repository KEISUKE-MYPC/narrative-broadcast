import type { PositionData, AssetConfig, SourceNote } from '../types';

export function parseFunding(raw: { symbol: string; value: number }[]) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({ symbol: r.symbol, pct: r.value * 100 }));
}

export function parseOpenInterest(raw: { value: number }[]): number | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.reduce((sum, r) => sum + (r.value ?? 0), 0);
}

export function parseLongShort(
  raw: { symbol: string; history: { t: number; l: number }[] }[],
): number | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const hist = raw[0]?.history;
  if (!hist || hist.length === 0) return null;
  return hist[hist.length - 1].l;
}

export async function fetchCoinalyze(
  cfg: AssetConfig, notes: SourceNote[],
): Promise<PositionData> {
  const key = process.env.COINALYZE_API_KEY;
  if (!key) throw new Error('COINALYZE_API_KEY missing');
  const base = 'https://api.coinalyze.net/v1';
  const now = Math.floor(Date.now() / 1000);
  const out: PositionData = { funding: [], oi_usd: null, ls_long_pct: null };
  try {
    const r = await fetch(`${base}/funding-rate?api_key=${key}&symbols=${cfg.coinalyzeSymbols}`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    out.funding = parseFunding(await r.json());
  } catch (e) { notes.push({ source: 'Coinalyze', message: `funding: ${(e as Error).message}` }); }
  try {
    const r = await fetch(`${base}/open-interest?api_key=${key}&symbols=${cfg.coinalyzeSymbols}&convert_to_usd=true`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    out.oi_usd = parseOpenInterest(await r.json());
  } catch (e) { notes.push({ source: 'Coinalyze', message: `oi: ${(e as Error).message}` }); }
  try {
    const primary = cfg.coinalyzeSymbols.split(',')[0];
    const r = await fetch(`${base}/long-short-ratio-history?api_key=${key}&symbols=${primary}&interval=1hour&from=${now - 21600}&to=${now}`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    out.ls_long_pct = parseLongShort(await r.json());
  } catch (e) { notes.push({ source: 'Coinalyze', message: `ls: ${(e as Error).message}` }); }
  return out;
}
