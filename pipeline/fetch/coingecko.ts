import type { MarketData, AssetConfig } from '../types';

type RawCoin = { market_data: any };
type RawGlobal = { data: any };
type RawCat = { name: string; market_cap_change_24h: number | null };

export function parseCoinGecko(
  coin: RawCoin, global: RawGlobal, cats: RawCat[],
): MarketData {
  const md = coin.market_data;
  return {
    price_usd: md.current_price.usd,
    chg_24h: md.price_change_percentage_24h,
    chg_7d: md.price_change_percentage_7d,
    chg_30d: md.price_change_percentage_30d,
    ath: md.ath.usd,
    ath_change_pct: md.ath_change_percentage.usd,
    ath_date: md.ath_date.usd,
    btc_dominance: global.data.market_cap_percentage.btc,
    total_mcap_chg_24h: global.data.market_cap_change_percentage_24h_usd,
    sectors_top: cats.slice(0, 5).map((c) => ({
      name: c.name, chg24h: c.market_cap_change_24h ?? 0,
    })),
  };
}

export async function fetchCoinGecko(cfg: AssetConfig): Promise<MarketData> {
  const base = 'https://api.coingecko.com/api/v3';
  const key = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = key ? { 'x-cg-demo-api-key': key } : {};
  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`CoinGecko ${path} -> ${res.status}`);
    return res.json();
  };
  const [coin, global, cats] = await Promise.all([
    get(`/coins/${cfg.coingeckoId}?localization=false&tickers=false&market_data=true&community_data=false`),
    get('/global'),
    get('/coins/categories?order=market_cap_change_24h_desc'),
  ]);
  return parseCoinGecko(coin, global, cats);
}
