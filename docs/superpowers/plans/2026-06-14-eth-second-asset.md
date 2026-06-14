# ETH を第2銘柄として追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** ETH の6h分析を BTC 同等の3層で自動生成・公開。オンチェーン取得を銘柄汎用化し、ETH は Coin Metrics(MVRV/活動アドレス/取引所フロー)を使う。

**Architecture:** OnchainData をラベル付きメトリクス汎用形に変更(BTC挙動不変)→ Coin Metrics fetch 新設 → config駆動でonchain源を切替 → ETH config追加 → プロンプトのATHハードコード修正 → workflow asset化 → categories登録。

**実装順(依存考慮):** Task1→2→4→3→5→6→7→8

---

### Task 1: OnchainData を汎用形にリファクタ(BTC挙動不変)
Files: `pipeline/types.ts`, `pipeline/fetch/bitcoindata.ts`, `pipeline/build-prompt.ts`, `pipeline/run.ts`, `pipeline/build-prompt.test.ts`, `pipeline/run.test.ts`

- [ ] Step 1: types.ts の OnchainData を置換:
```ts
export type OnchainMetric = { label: string; value: number | string | null };
export type OnchainData = { asof: string | null; metrics: OnchainMetric[] };
```
- [ ] Step 2: bitcoindata.ts の fetchOnchain を新形に(parseBitcoinDataMetric は不変):
```ts
export async function fetchOnchain(notes: SourceNote[]): Promise<OnchainData> {
  const out: OnchainData = { asof: null, metrics: [] };
  const labels: Record<string,string> = { mvrv_z: 'MVRV-Z', sopr: 'SOPR' };
  for (const m of METRICS) {
    try {
      const res = await fetch(`https://bitcoin-data.com/v1/${m.path}/last`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const parsed = parseBitcoinDataMetric(await res.json(), m.field);
      out.metrics.push({ label: labels[m.key], value: parsed.value });
      if (parsed.asof) out.asof = parsed.asof;
    } catch (e) { notes.push({ source: 'bitcoin-data', message: `${m.path}: ${(e as Error).message}` }); }
  }
  return out;
}
```
- [ ] Step 3: build-prompt.ts fmtData のオンチェーン行:
```ts
if (o && o.metrics.length) lines.push(`- オンチェーン: ${o.metrics.map((x) => `${x.label} ${x.value ?? 'N/A'}`).join(' / ')}（asof ${o.asof ?? 'N/A'}）`);
```
- [ ] Step 4: run.ts summarizeKeyData:
```ts
if (b.onchain && b.onchain.metrics.length) { const m = b.onchain.metrics[0]; parts.push(`${m.label}${m.value ?? 'N/A'}`); }
```
- [ ] Step 5: テストフィクスチャ更新:
  - build-prompt.test.ts:10 を `onchain: { asof: '2026-06-11', metrics: [{label:'MVRV-Z',value:0.344},{label:'SOPR',value:0.988}] },`
  - run.test.ts の onchain を `onchain: { asof: null, metrics: [{label:'MVRV-Z',value:0.344}] }`
- [ ] Step 6: `npx vitest run pipeline` と `npx tsc --noEmit` 確認。
- [ ] Step 7: commit `refactor(pipeline): OnchainDataをラベル付き汎用形に(BTC挙動不変)`

---

### Task 2: Coin Metrics オンチェーン取得を新設
Files: `pipeline/fetch/coinmetrics.ts`, `pipeline/fetch/coinmetrics.test.ts`, `pipeline/__fixtures__/coinmetrics_eth.json`

- [ ] Step 1: フィクスチャ `coinmetrics_eth.json`:
```json
{"data":[{"asset":"eth","time":"2026-06-13T00:00:00.000000000Z","CapMVRVCur":"0.836","AdrActCnt":"480000","FlowInExUSD":"120000000","FlowOutExUSD":"95000000"}]}
```
- [ ] Step 2: 失敗テスト coinmetrics.test.ts:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCoinMetrics } from './coinmetrics';
const f = (n:string)=>JSON.parse(readFileSync(join(__dirname,`../__fixtures__/${n}`),'utf8'));
describe('parseCoinMetrics', () => {
  it('MVRV/活動アドレス/取引所ネットフローを抽出', () => {
    const o = parseCoinMetrics(f('coinmetrics_eth.json'));
    expect(o.asof).toBe('2026-06-13');
    const labels = o.metrics.map(m=>m.label);
    expect(labels).toContain('MVRV');
    expect(labels).toContain('活動アドレス');
    expect(labels).toContain('取引所ネットフロー');
    expect(Number(o.metrics.find(m=>m.label==='MVRV')!.value)).toBeCloseTo(0.836, 2);
  });
  it('欠損メトリクスは省く', () => {
    const o = parseCoinMetrics({ data: [{ time:'2026-06-13T00:00:00Z', CapMVRVCur:'0.9' }] });
    expect(o.metrics.map(m=>m.label)).toEqual(['MVRV']);
  });
  it('dataが空なら空metrics', () => {
    expect(parseCoinMetrics({ data: [] }).metrics).toEqual([]);
  });
});
```
- [ ] Step 3: 実装 coinmetrics.ts:
```ts
import type { OnchainData, AssetConfig, SourceNote } from '../types';

export function parseCoinMetrics(raw: any): OnchainData {
  const rows = Array.isArray(raw?.data) ? raw.data : [];
  const last = rows[rows.length - 1];
  if (!last) return { asof: null, metrics: [] };
  const num = (v: any) => (v == null || v === '' ? null : Number(v));
  const metrics: OnchainData['metrics'] = [];
  const mvrv = num(last.CapMVRVCur);
  if (mvrv != null) metrics.push({ label: 'MVRV', value: Math.round(mvrv * 1000) / 1000 });
  const act = num(last.AdrActCnt);
  if (act != null) metrics.push({ label: '活動アドレス', value: act });
  const fin = num(last.FlowInExUSD), fout = num(last.FlowOutExUSD);
  if (fin != null && fout != null) metrics.push({ label: '取引所ネットフロー', value: `$${Math.round((fin - fout) / 1e6)}M` });
  const asof = typeof last.time === 'string' ? last.time.slice(0, 10) : null;
  return { asof, metrics };
}

export async function fetchCoinMetricsOnchain(cfg: AssetConfig, notes: SourceNote[]): Promise<OnchainData> {
  const a = cfg.coinmetricsAsset;
  if (!a) return { asof: null, metrics: [] };
  const base = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
  const mets = 'CapMVRVCur,AdrActCnt,FlowInExUSD,FlowOutExUSD';
  try {
    const res = await fetch(`${base}?assets=${a}&metrics=${mets}&frequency=1d&page_size=1&end_time=${new Date().toISOString().slice(0,10)}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return parseCoinMetrics(await res.json());
  } catch (e) {
    notes.push({ source: 'CoinMetrics', message: (e as Error).message });
    return { asof: null, metrics: [] };
  }
}
```
> 注: CM は銘柄が一部メトリクス非対応だと 4xx を返す。Task4 Step1 で ETH 実APIを叩き、4xx になる指標があれば mets から外す(ETH は4種いける見込み)。
- [ ] Step 4: `npx vitest run pipeline/fetch/coinmetrics.test.ts` PASS。
- [ ] Step 5: commit `feat(pipeline): Coin Metricsオンチェーン取得を追加`

---

### Task 4: ETH config
Files: `pipeline/config/eth.ts`

- [ ] Step 1: 実値検証(実装時):
  - ETH ATH: `curl -s "https://api.coingecko.com/api/v3/coins/ethereum?localization=false&tickers=false&market_data=true" | python3 -c "import sys,json;d=json.load(sys.stdin)['market_data'];print(d['ath']['usd'], d['ath_date']['usd'])"`
  - Coinalyze ETH perp シンボルの funding が返るか確認(返らねば命名調整)。
  - ETH の Polymarket 年末市場の有無(無ければ polymarketSlug:'')。
  - CoinMetrics ETH の4メトリクスが 200 で返るか確認。
- [ ] Step 2: eth.ts 作成(検証値を埋める):
```ts
import type { AssetConfig } from '../types';
export const ethConfig: AssetConfig = {
  key: 'eth', cycle: '6h', coingeckoId: 'ethereum',
  glassnodeAsset: 'ETH',
  onchainSource: 'coinmetrics', coinmetricsAsset: 'eth',
  santimentSize: 12,
  coinalyzeSymbols: '<Step1で検証>',
  polymarketSlug: '<ETH市場 or 空>', oddsTargets: [],
  baselineAth: <Step1 ATH>, baselineAthDate: '<Step1 日付>',
  outputDir: 'articles',
  promptIntro: 'ETH（イーサリアム）の6hナラティブ分析。市場参加者がETHをどう語っているか、その語り口の変化を構造分析する。',
};
```
- [ ] Step 3: `npx tsc --noEmit` clean。
- [ ] Step 4: commit `feat(pipeline): ETH config を追加`

---

### Task 3: AssetConfig 拡張・run.ts の onchain 源切替・ETH登録
Files: `pipeline/types.ts`, `pipeline/config/btc.ts`, `pipeline/run.ts`

- [ ] Step 1: types.ts AssetConfig に追加:
```ts
  onchainSource: 'bitcoindata' | 'coinmetrics';
  coinmetricsAsset?: string;
```
- [ ] Step 2: config/btc.ts に `onchainSource: 'bitcoindata',` 追加(glassnodeAsset:'BTC' 維持)。
- [ ] Step 3: run.ts に import 追加: `import { fetchCoinMetricsOnchain } from './fetch/coinmetrics';` `import { ethConfig } from './config/eth';`。`CONFIGS` を `{ btc: btcConfig, eth: ethConfig }`。
- [ ] Step 4: collect の onchain 取得(Promise.all の該当要素)を:
```ts
safe('Onchain', () => cfg.onchainSource === 'coinmetrics' ? fetchCoinMetricsOnchain(cfg, notes) : fetchOnchain(notes)),
```
- [ ] Step 5: `npx tsc --noEmit` clean、`npx vitest run pipeline` PASS。
- [ ] Step 6: commit `feat(pipeline): onchain源をconfig駆動化しETHを登録`

---

### Task 5: プロンプトのATHハードコード修正＋odds任意化
Files: `pipeline/build-prompt.ts`, `pipeline/run.ts`

- [ ] Step 1: GUARDRAILS 項目2 から固有数値を除き一般文に(「基準ATHから見て今どこかを述べる」)。buildPrompt 本体で cfg から差し込む:
```ts
const baseline = cfg.baselineAth
  ? `\n# ベースライン\n基準ATH $${cfg.baselineAth}（${cfg.baselineAthDate}）から見て今どこかを必ず述べる。\n`
  : '';
// テンプレートの ${GUARDRAILS} の直後に ${baseline} を挿入
```
- [ ] Step 2: odds 任意化。run.ts collect の Polymarket を:
```ts
safe('Polymarket', () => cfg.polymarketSlug ? fetchPolymarket(cfg) : Promise.resolve(null)),
```
- [ ] Step 3: build-prompt.test.ts が `126080` を含むこと(btcConfig.baselineAth=126080 差し込み)を確認。
- [ ] Step 4: `npx vitest run pipeline` PASS、`npx tsc --noEmit` clean。
- [ ] Step 5: commit `fix(pipeline): 基準ATHをconfig化しoddsを任意化(多銘柄対応)`

---

### Task 6: workflow を asset パラメータ化
Files: `.github/workflows/publish-btc.yml`

- [ ] Step 1: workflow_dispatch を入力付きに:
```yaml
on:
  workflow_dispatch:
    inputs:
      asset:
        description: 'asset key (btc/eth)'
        required: false
        default: 'btc'
```
- [ ] Step 2: 生成ステップを `run: npx tsx pipeline/run.ts ${{ github.event.inputs.asset || 'btc' }}`。
- [ ] Step 3: concurrency.group は現状維持(全銘柄共有=直列化)。
- [ ] Step 4: YAML健全性: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/publish-btc.yml'));print('OK')"`。
- [ ] Step 5: commit `ci(pipeline): publish workflowをassetパラメータ化(btc/eth)`

---

### Task 7: サイトに ETH 分野を登録
Files: `lib/categories.ts`

- [ ] Step 1: CATEGORIES に追加:
```ts
{ slug: 'eth', label: 'Ethereum ナラティブ', short: 'ETH',
  description: '市場参加者の物語と認知を6時間ごとに構造分析',
  symbol: 'Ξ', accent: 'var(--accent)', ogAccent: '#8a92b2' },
```
- [ ] Step 2: `npx tsc --noEmit` clean、`npm run build` 成功。
- [ ] Step 3: commit `feat(site): ETH 分野を categories に登録`

---

### Task 8: 全体検証 + ドライラン
- [ ] Step 1: `npx vitest run`(全パス)、`npx tsc --noEmit`(clean)、`npm run build`(成功)。
- [ ] Step 2: ETH ドライラン(secrets要):
  `OLLAMA_API_KEY=... SANTIMENT_API_KEY=... COINALYZE_API_KEY=... npx tsx pipeline/run.ts eth --no-publish`
  期待: market/positions/onchain(CoinMetrics)/trends が揃い、notes に致命的欠落なし、3層が記事に出る。
- [ ] Step 3: push(ユーザー許可後)。
- [ ] Step 4: 本番1本(workflow_dispatch asset=eth or cron-job.org Run now)→ `…-6h-eth.md` 公開。
- [ ] Step 5: サイト確認: ETH記事200・SiteNav に ETH・トップ/アーカイブに ETH カテゴリ。
- [ ] Step 6: cron-job.org に ETH ジョブ追加(ユーザー作業): 同 dispatch URL、body `{"ref":"main","inputs":{"asset":"eth"}}`、時刻は BTC と数分ずらす、失敗通知ON。
- [ ] Step 7: BTC 自動公開が回帰なく継続を次サイクルで確認。

---

## Self-Review メモ
- Spec coverage: 汎用化=T1, CoinMetrics=T2, ETHconfig=T4, run切替/登録=T3, ATH修正/odds任意=T5, 自動化=T6, サイト=T7, 検証=T8。全項目対応。
- 型整合: OnchainData新形(asof/metrics)はT1で定義し fetch/fmtData/summarize/テストで一貫。AssetConfig.onchainSource はT3追加・btc/eth両configで設定。
- 実値(ETH ATH/Coinalyzeシンボル/Polymarket有無/CM対応)はT4 Step1で実APIで確定。
