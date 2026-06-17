import type { OddsData, AssetConfig } from '../types';

// outcomePrices は gamma API では JSON文字列（例 '["0.0215","0.9785"]'）で返る。
// 旧形式の配列も念のため許容する。
type Raw = { events?: { slug: string; markets: { groupItemTitle: string; outcomePrices: string | string[] }[] }[] };

// '$55,000' / '↑ 55,000' -> '55000'（市場名は「hit $X」なので上下の矢印は落としてよい）
function normalizeTitle(title: string): string {
  return title.replace(/[^0-9]/g, '');
}

// outcomePrices をJSON文字列でも配列でも先頭(YES側)の数値にする。失敗時はnull。
function firstPrice(op: string | string[] | undefined): number | null {
  if (op == null) return null;
  let arr: unknown = op;
  if (typeof op === 'string') {
    try { arr = JSON.parse(op); } catch { return null; }
  }
  if (!Array.isArray(arr) || arr[0] == null) return null;
  const n = Number(arr[0]);
  return Number.isFinite(n) ? n : null;
}

export function parsePolymarket(raw: Raw, cfg: AssetConfig): OddsData {
  if (!Array.isArray(raw.events)) return { targets: {}, market_slug: cfg.polymarketSlug };
  const ev = raw.events.find((e) => e.slug === cfg.polymarketSlug);
  const targets: Record<string, number> = {};
  if (ev) {
    for (const m of ev.markets) {
      const key = normalizeTitle(m.groupItemTitle);
      const p = firstPrice(m.outcomePrices);
      if (cfg.oddsTargets.includes(key) && p != null) {
        targets[key] = p * 100;
      }
    }
  }
  return { targets, market_slug: cfg.polymarketSlug };
}

export async function fetchPolymarket(cfg: AssetConfig): Promise<OddsData> {
  const res = await fetch(
    `https://gamma-api.polymarket.com/events?slug=${cfg.polymarketSlug}`,
  );
  if (!res.ok) throw new Error(`Polymarket -> ${res.status}`);
  const events = await res.json();
  return parsePolymarket({ events }, cfg);
}
