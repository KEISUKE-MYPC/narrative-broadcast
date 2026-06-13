import { writeFileSync } from 'node:fs';
import type { FetchBundle, SourceNote } from './types';
import { btcConfig } from './config/btc';
import { fetchCoinGecko } from './fetch/coingecko';
import { fetchOnchain } from './fetch/bitcoindata';
import { fetchSantiment } from './fetch/santiment';
import { fetchCoinalyze } from './fetch/coinalyze';
import { fetchPolymarket } from './fetch/polymarket';
import { fetchDefiLlama } from './fetch/defillama';
import { loadRecentNarratives } from './lib/recent';
import { buildPrompt } from './build-prompt';
import { generateArticle } from './generate';
import { publish, datetimeJst } from './publish';
import type { AssetConfig } from './types';

const CONFIGS: Record<string, AssetConfig> = { btc: btcConfig };

export function summarizeKeyData(b: FetchBundle): string {
  const parts: string[] = [];
  if (b.market) parts.push(`BTC$${b.market.price_usd.toLocaleString('en-US')}（ATH${b.market.ath_change_pct}%）`);
  if (b.market) parts.push(`ドミナンス${b.market.btc_dominance}%`);
  if (b.onchain) parts.push(`MVRV-Z${b.onchain.mvrv_z ?? 'N/A'}/SOPR${b.onchain.sopr ?? 'N/A'}`);
  return parts.join('・');
}

async function collect(cfg: AssetConfig): Promise<FetchBundle> {
  const notes: SourceNote[] = [];
  const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); }
    catch (e) { notes.push({ source: label, message: (e as Error).message }); return null; }
  };
  const [market, onchain, trends, positions, odds, stables] = await Promise.all([
    safe('CoinGecko', () => fetchCoinGecko(cfg)),
    safe('Onchain', () => fetchOnchain(notes)),
    safe('Santiment', () => fetchSantiment(cfg)),
    safe('Coinalyze', () => fetchCoinalyze(cfg, notes)),
    safe('Polymarket', () => fetchPolymarket(cfg)),
    safe('DefiLlama', () => fetchDefiLlama()),
  ]);
  return { market, onchain, trends, positions, odds, stables, notes };
}

async function main() {
  const key = process.argv[2] ?? 'btc';
  const noPublish = process.argv.includes('--no-publish');
  const cfg = CONFIGS[key];
  if (!cfg) throw new Error(`unknown asset: ${key}`);

  const now = new Date();
  const bundle = await collect(cfg);
  const recent = loadRecentNarratives(5);
  const prompt = buildPrompt(bundle, recent, cfg, datetimeJst(now));
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) throw new Error('OLLAMA_API_KEY missing');
  const article = await generateArticle(prompt, { apiKey });

  if (noPublish) {
    const out = `/tmp/${cfg.key}-dryrun.md`;
    writeFileSync(out, article, 'utf8');
    console.log(`[dry-run] wrote ${out}\n--- notes ---\n${JSON.stringify(bundle.notes, null, 2)}`);
    console.log(`\n--- article ---\n${article}`);
    return;
  }
  const res = publish({ cfg, markdown: article, keyData: summarizeKeyData(bundle), now, root: process.cwd() });
  console.log(res.skipped ? `skipped (exists): ${res.path}` : `published: ${res.path}`);
}

if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
