import type { OddsData, AssetConfig } from '../types';

type Raw = { events: { slug: string; markets: { groupItemTitle: string; outcomePrices: string[] }[] }[] };

// '$55,000' -> '55000'
function normalizeTitle(title: string): string {
  return title.replace(/[^0-9]/g, '');
}

export function parsePolymarket(raw: Raw, cfg: AssetConfig): OddsData {
  const ev = raw.events.find((e) => e.slug === cfg.polymarketSlug);
  const targets: Record<string, number> = {};
  if (ev) {
    for (const m of ev.markets) {
      const key = normalizeTitle(m.groupItemTitle);
      if (cfg.oddsTargets.includes(key) && m.outcomePrices?.[0] != null) {
        targets[key] = Number(m.outcomePrices[0]) * 100;
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
