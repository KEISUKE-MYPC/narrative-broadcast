import type { FetchBundle, AssetConfig } from './types';

// 記事末尾に付ける「実データ計器盤（出典）」。
// LLMに書かせず、取得済みの bundle から決定論的に組む（値・出典が常に正確）。

const DISCLAIMER = '※本記事は情報提供を目的としたものであり、投資助言ではありません。';

// onchainSource → 表示用ソース名
function onchainSrc(cfg: AssetConfig): string {
  switch (cfg.onchainSource) {
    case 'bitcoindata': return 'bitcoin-data.com';
    case 'coinmetrics': return 'CoinMetrics';
    case 'defillama-chain': return 'DefiLlama';
  }
}

type Row = { label: string; value: string; source: string };

/** bundle から計器盤テーブル(markdown)を生成。データが何も無ければ空文字。 */
export function buildDataTable(b: FetchBundle, cfg: AssetConfig): string {
  const rows: Row[] = [];
  const m = b.market, o = b.onchain, p = b.positions, s = b.stables;

  const pct = (n: number) => `${n.toFixed(2)}%`;
  if (m) {
    rows.push({ label: '価格', value: `$${m.price_usd.toLocaleString('en-US')}（24h ${pct(m.chg_24h)} / 7d ${pct(m.chg_7d)} / 30d ${pct(m.chg_30d)}）`, source: 'CoinGecko' });
    rows.push({ label: 'ATH比', value: `${pct(m.ath_change_pct)}（ATH $${m.ath.toLocaleString('en-US')}・${m.ath_date.slice(0, 10)}）`, source: 'CoinGecko' });
    rows.push({ label: 'BTCドミナンス', value: pct(m.btc_dominance), source: 'CoinGecko' });
    if (m.sectors_top.length) rows.push({ label: '上昇セクター', value: m.sectors_top.slice(0, 3).map((x) => `${x.name}(${x.chg24h.toFixed(1)}%)`).join('、'), source: 'CoinGecko' });
  }
  if (o && o.metrics.length) {
    const src = onchainSrc(cfg);
    for (const x of o.metrics) rows.push({ label: x.label, value: `${x.value ?? 'N/A'}${o.asof ? `（asof ${o.asof}）` : ''}`, source: src });
  }
  if (p) {
    if (p.funding.length) rows.push({ label: '資金調達率', value: p.funding.map((f) => `${f.symbol}:${f.pct.toFixed(4)}%`).join(' / '), source: 'Coinalyze' });
    if (p.oi_usd != null) rows.push({ label: '建玉(OI)', value: `$${(p.oi_usd / 1e9).toFixed(2)}B`, source: 'Coinalyze' });
    if (p.ls_long_pct != null) rows.push({ label: 'L/S比', value: `long ${p.ls_long_pct}%`, source: 'Coinalyze' });
  }
  if (s) rows.push({ label: 'ステーブル総供給', value: `$${(s.total_usd / 1e9).toFixed(2)}B（W/W ${s.wow_change_pct?.toFixed(2) ?? 'N/A'}%）`, source: 'DefiLlama' });
  if (b.trends && b.trends.length) rows.push({ label: 'トレンド語', value: b.trends.map((w) => w.word).join('、'), source: 'Santiment' });
  if (b.odds) {
    // 取得失敗(NaN)のターゲットは除外。全滅なら行ごと省略。
    const valid = Object.entries(b.odds.targets).filter(([, v]) => Number.isFinite(v));
    if (valid.length) rows.push({ label: '年末オッズ', value: valid.map(([k, v]) => `$${k}:${v}%`).join(' / '), source: 'Polymarket' });
  }

  if (!rows.length) return '';
  const body = rows.map((r) => `| ${r.label} | ${r.value} | ${r.source} |`).join('\n');
  return `## 実データ計器盤（出典）\n\n取得時点の実測値。本文の数値はこれに基づく。\n\n| 指標 | 実測値 | ソース |\n|---|---|---|\n${body}`;
}

/** 記事の免責文の直前にテーブルを差し込む（免責文が無ければ末尾に追記）。 */
export function appendDataTable(article: string, table: string): string {
  if (!table) return article;
  if (article.includes(DISCLAIMER)) {
    return article.replace(DISCLAIMER, `${table}\n\n${DISCLAIMER}`);
  }
  return `${article.trimEnd()}\n\n${table}\n`;
}
