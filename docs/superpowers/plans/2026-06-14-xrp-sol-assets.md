# XRP・SOL 銘柄追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** XRP と SOL をナラティブ分析の第3・第4銘柄として追加する（XRPはCoinMetrics、SOLは新オンチェーン源DefiLlama-chain）。

**Architecture:** ETH確立のconfig駆動多銘柄アーキを踏襲。`onchainSource` ディスクリミネータに `'defillama-chain'` を1つ追加し、SOLのオンチェーン層（TVL/DEX/手数料）を成立させる。XRPは既存 `'coinmetrics'` 経路を再利用。サイトは slug 規約で自動対応。

**Tech Stack:** TypeScript, Next.js(App Router), vitest, DefiLlama/CoinMetrics/CoinGecko/Coinalyze API。

参照spec: `docs/superpowers/specs/2026-06-14-xrp-sol-assets-design.md`

---

## File Structure

- `pipeline/types.ts`（変更）: `onchainSource` に `'defillama-chain'`、`defillamaChain?: string` 追加。
- `pipeline/fetch/defillama-chain.ts`（新規）: SOLチェーン活動のオンチェーン取得。
- `pipeline/fetch/defillama-chain.test.ts`（新規）: parse の単体テスト。
- `pipeline/fetch/coinmetrics.test.ts`（変更）: XRP（フロー欠落）ケース追加。
- `pipeline/__fixtures__/coinmetrics_xrp.json`（新規）: XRP実データ。
- `pipeline/config/xrp.ts`・`sol.ts`（新規）＋ `xrp.test.ts`・`sol.test.ts`（新規）。
- `pipeline/run.ts`（変更）: import追加・onchain分岐追加・CONFIGS登録。
- `public/icons/xrp.svg`・`sol.svg`（新規）: 公式カラーアイコン。
- `lib/categories.ts`（変更）: XRP・SOL分野を登録。

---

### Task 1: DefiLlama-chain オンチェーン源（SOL用）

**Files:**
- Modify: `pipeline/types.ts`
- Create: `pipeline/fetch/defillama-chain.ts`
- Test: `pipeline/fetch/defillama-chain.test.ts`

- [ ] **Step 1: types.ts を拡張**

`pipeline/types.ts` の `AssetConfig` を以下に変更（`onchainSource` の union に `'defillama-chain'` を追加し、`defillamaChain?` を追加）:

```ts
export type AssetConfig = {
  key: string;            // 'btc'（ファイル名接尾辞）
  cycle: string;          // '6h'
  coingeckoId: string;    // 'bitcoin'
  glassnodeAsset: string; // 'BTC'
  onchainSource: 'bitcoindata' | 'coinmetrics' | 'defillama-chain';
  santimentSize: number;  // 12
  coinalyzeSymbols: string;
  coinmetricsAsset?: string; // 'eth' など（未設定の場合はオンチェーン取得スキップ）
  defillamaChain?: string;   // 'Solana' など（onchainSource='defillama-chain'時のチェーン名）
  polymarketSlug: string; // 'what-price-will-bitcoin-hit-before-2027'
  oddsTargets: string[];  // ['55000','50000','45000','100000','120000']
  baselineAth: number;    // 126080
  baselineAthDate: string;// '2025-10-06'
  outputDir: string;      // 'articles'
  promptIntro: string;    // 銘柄固有の導入（build-promptで使用）
};
```

- [ ] **Step 2: 失敗するテストを書く**

`pipeline/fetch/defillama-chain.test.ts` を作成:

```ts
import { describe, it, expect } from 'vitest';
import { parseDefiLlamaChain } from './defillama-chain';

describe('parseDefiLlamaChain', () => {
  it('TVL/DEX出来高/手数料をラベル付きで整形', () => {
    const o = parseDefiLlamaChain(
      [{ date: 1781308800, tvl: 4500000000 }, { date: 1781395200, tvl: 4772228604 }],
      { total24h: 1005291480 },
      { total24h: 4803194 },
      '2026-06-14',
    );
    expect(o.asof).toBe('2026-06-14');
    expect(o.metrics).toEqual([
      { label: 'チェーンTVL', value: '$4.77B' },
      { label: 'DEX出来高(24h)', value: '$1.01B' },
      { label: '手数料(24h)', value: '$4.8M' },
    ]);
  });

  it('欠損ソースは省く', () => {
    const o = parseDefiLlamaChain(null, { total24h: 1005291480 }, null, '2026-06-14');
    expect(o.metrics.map((m) => m.label)).toEqual(['DEX出来高(24h)']);
  });

  it('全欠損なら asof=null・空metrics', () => {
    expect(parseDefiLlamaChain(null, null, null, '2026-06-14')).toEqual({ asof: null, metrics: [] });
  });
});
```

- [ ] **Step 3: テストが落ちることを確認**

Run: `npx vitest run pipeline/fetch/defillama-chain.test.ts`
Expected: FAIL（`parseDefiLlamaChain` 未定義 / モジュール解決エラー）

- [ ] **Step 4: 実装を書く**

`pipeline/fetch/defillama-chain.ts` を作成:

```ts
import type { AssetConfig, OnchainData, OnchainMetric, SourceNote } from '../types';

// 金額整形：$X.XXB / $X.XM / $1,234
function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

type TvlPoint = { date: number; tvl: number };
type Overview = { total24h?: number };

// 3ソースの生データ（取得失敗分は null）からラベル付きメトリクスを組む。取れたものだけ積む。
export function parseDefiLlamaChain(
  tvl: TvlPoint[] | null,
  dex: Overview | null,
  fees: Overview | null,
  asof: string,
): OnchainData {
  const metrics: OnchainMetric[] = [];
  if (Array.isArray(tvl) && tvl.length) {
    const last = tvl[tvl.length - 1];
    if (typeof last?.tvl === 'number') metrics.push({ label: 'チェーンTVL', value: fmtUsd(last.tvl) });
  }
  if (dex && typeof dex.total24h === 'number') metrics.push({ label: 'DEX出来高(24h)', value: fmtUsd(dex.total24h) });
  if (fees && typeof fees.total24h === 'number') metrics.push({ label: '手数料(24h)', value: fmtUsd(fees.total24h) });
  return { asof: metrics.length ? asof : null, metrics };
}

export async function fetchDefiLlamaChain(cfg: AssetConfig, notes: SourceNote[]): Promise<OnchainData> {
  const chain = cfg.defillamaChain;
  if (!chain) return { asof: null, metrics: [] };
  const slug = chain.toLowerCase();
  const asof = new Date().toISOString().slice(0, 10);
  const getJson = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  };
  let tvl: TvlPoint[] | null = null;
  let dex: Overview | null = null;
  let fees: Overview | null = null;
  try { tvl = await getJson(`https://api.llama.fi/v2/historicalChainTvl/${chain}`); }
  catch (e) { notes.push({ source: 'DefiLlama-chain', message: `tvl: ${(e as Error).message}` }); }
  try { dex = await getJson(`https://api.llama.fi/overview/dexs/${slug}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`); }
  catch (e) { notes.push({ source: 'DefiLlama-chain', message: `dex: ${(e as Error).message}` }); }
  try { fees = await getJson(`https://api.llama.fi/overview/fees/${slug}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`); }
  catch (e) { notes.push({ source: 'DefiLlama-chain', message: `fees: ${(e as Error).message}` }); }
  return parseDefiLlamaChain(tvl, dex, fees, asof);
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run pipeline/fetch/defillama-chain.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 6: コミット**

```bash
git add pipeline/types.ts pipeline/fetch/defillama-chain.ts pipeline/fetch/defillama-chain.test.ts
git commit -m "feat(pipeline): defillama-chainオンチェーン源を追加(SOL用)"
```

---

### Task 2: run.ts に defillama-chain 分岐を追加

**Files:**
- Modify: `pipeline/run.ts:7`（import追加）, `pipeline/run.ts:36`（onchain分岐）

- [ ] **Step 1: import を追加**

`pipeline/run.ts` の7行目 `import { fetchCoinMetricsOnchain } from './fetch/coinmetrics';` の直後に追加:

```ts
import { fetchDefiLlamaChain } from './fetch/defillama-chain';
```

- [ ] **Step 2: onchain 分岐を3分岐に変更**

`pipeline/run.ts` の `collect()` 内、現在の行:

```ts
    safe('Onchain', () => cfg.onchainSource === 'coinmetrics' ? fetchCoinMetricsOnchain(cfg, notes) : fetchOnchain(notes)),
```

を次に置換:

```ts
    safe('Onchain', () =>
      cfg.onchainSource === 'coinmetrics' ? fetchCoinMetricsOnchain(cfg, notes)
      : cfg.onchainSource === 'defillama-chain' ? fetchDefiLlamaChain(cfg, notes)
      : fetchOnchain(notes)),
```

- [ ] **Step 3: 型チェックと既存テストの回帰確認**

Run: `npx tsc --noEmit && npx vitest run pipeline/run.test.ts`
Expected: 型エラーなし・run.test.ts PASS

- [ ] **Step 4: コミット**

```bash
git add pipeline/run.ts
git commit -m "feat(pipeline): onchain分岐にdefillama-chainを追加"
```

---

### Task 3: XRP の CoinMetrics 対応（フロー欠落ケース）

**Files:**
- Create: `pipeline/__fixtures__/coinmetrics_xrp.json`
- Modify: `pipeline/fetch/coinmetrics.test.ts`

- [ ] **Step 1: fixture を作成**

`pipeline/__fixtures__/coinmetrics_xrp.json`（XRPは FlowIn/Out 非対応＝MVRVと活動アドレスのみ。実API 2026-06-13 値）:

```json
{
  "data": [
    {
      "asset": "xrp",
      "time": "2026-06-13T00:00:00.000000000Z",
      "AdrActCnt": "31184",
      "CapMVRVCur": "0.785002627466808851"
    }
  ]
}
```

- [ ] **Step 2: 失敗するテストを追加**

`pipeline/fetch/coinmetrics.test.ts` の `describe('parseCoinMetrics', ...)` ブロック内（最後の `it` の後）に追加:

```ts
  it('XRP: フロー欠落時はMVRVと活動アドレスのみ', () => {
    const o = parseCoinMetrics(f('coinmetrics_xrp.json'));
    expect(o.asof).toBe('2026-06-13');
    expect(o.metrics.map((m) => m.label)).toEqual(['MVRV', '活動アドレス']);
    expect(Number(o.metrics.find((m) => m.label === 'MVRV')!.value)).toBeCloseTo(0.785, 2);
    expect(Number(o.metrics.find((m) => m.label === '活動アドレス')!.value)).toBe(31184);
  });
```

- [ ] **Step 3: テスト実行（既存 parseCoinMetrics で通るはず）**

Run: `npx vitest run pipeline/fetch/coinmetrics.test.ts`
Expected: PASS（既存 `parseCoinMetrics` は欠損メトリクスを省く実装のため、追加分も含め全 PASS）

- [ ] **Step 4: コミット**

```bash
git add pipeline/__fixtures__/coinmetrics_xrp.json pipeline/fetch/coinmetrics.test.ts
git commit -m "test(pipeline): CoinMetrics XRP(フロー欠落)ケースを追加"
```

---

### Task 4: XRP config

**Files:**
- Create: `pipeline/config/xrp.ts`
- Test: `pipeline/config/xrp.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`pipeline/config/xrp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { xrpConfig } from './xrp';

describe('xrpConfig', () => {
  it('XRP識別子・CoinMetrics経路・基準ATHを持つ', () => {
    expect(xrpConfig.key).toBe('xrp');
    expect(xrpConfig.coingeckoId).toBe('ripple');
    expect(xrpConfig.onchainSource).toBe('coinmetrics');
    expect(xrpConfig.coinmetricsAsset).toBe('xrp');
    expect(xrpConfig.baselineAth).toBe(3.65);
    expect(xrpConfig.coinalyzeSymbols).toContain('XRP');
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run pipeline/config/xrp.test.ts`
Expected: FAIL（`./xrp` 解決エラー）

- [ ] **Step 3: config を作成**

`pipeline/config/xrp.ts`:

```ts
import type { AssetConfig } from '../types';

export const xrpConfig: AssetConfig = {
  key: 'xrp',
  cycle: '6h',
  coingeckoId: 'ripple',
  glassnodeAsset: 'XRP',
  onchainSource: 'coinmetrics',
  coinmetricsAsset: 'xrp',
  santimentSize: 12,
  coinalyzeSymbols: 'XRPUSDT_PERP.A,XRPUSD_PERP.A,XRP-PERPETUAL.2,XRPUSDT_PERP.4,XRPUSDT_PERP.F',
  polymarketSlug: '',
  oddsTargets: [],
  baselineAth: 3.65,
  baselineAthDate: '2025-07-18',
  outputDir: 'articles',
  promptIntro: 'XRP（リップル）の6hナラティブ分析。市場参加者がXRPをどう語っているか、その語り口の変化を構造分析する。',
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run pipeline/config/xrp.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add pipeline/config/xrp.ts pipeline/config/xrp.test.ts
git commit -m "feat(pipeline): XRP configを追加"
```

---

### Task 5: SOL config

**Files:**
- Create: `pipeline/config/sol.ts`
- Test: `pipeline/config/sol.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`pipeline/config/sol.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { solConfig } from './sol';

describe('solConfig', () => {
  it('SOL識別子・defillama-chain経路・基準ATHを持つ', () => {
    expect(solConfig.key).toBe('sol');
    expect(solConfig.coingeckoId).toBe('solana');
    expect(solConfig.onchainSource).toBe('defillama-chain');
    expect(solConfig.defillamaChain).toBe('Solana');
    expect(solConfig.baselineAth).toBe(293.31);
    expect(solConfig.coinalyzeSymbols).toContain('SOL');
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run pipeline/config/sol.test.ts`
Expected: FAIL（`./sol` 解決エラー）

- [ ] **Step 3: config を作成**

`pipeline/config/sol.ts`:

```ts
import type { AssetConfig } from '../types';

export const solConfig: AssetConfig = {
  key: 'sol',
  cycle: '6h',
  coingeckoId: 'solana',
  glassnodeAsset: 'SOL',
  onchainSource: 'defillama-chain',
  defillamaChain: 'Solana',
  santimentSize: 12,
  coinalyzeSymbols: 'SOLUSDT_PERP.A,SOLUSD_PERP.A,SOL-PERPETUAL.2,SOLUSDT_PERP.4,SOLUSDT_PERP.F',
  polymarketSlug: '',
  oddsTargets: [],
  baselineAth: 293.31,
  baselineAthDate: '2025-01-19',
  outputDir: 'articles',
  promptIntro: 'SOL（ソラナ）の6hナラティブ分析。市場参加者がSOLをどう語っているか、その語り口の変化を構造分析する。',
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run pipeline/config/sol.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add pipeline/config/sol.ts pipeline/config/sol.test.ts
git commit -m "feat(pipeline): SOL configを追加"
```

---

### Task 6: run.ts に XRP・SOL を登録

**Files:**
- Modify: `pipeline/run.ts:4`（import）, `pipeline/run.ts:18`（CONFIGS）

- [ ] **Step 1: import を追加**

`pipeline/run.ts` の4行目 `import { ethConfig } from './config/eth';` の直後に追加:

```ts
import { xrpConfig } from './config/xrp';
import { solConfig } from './config/sol';
```

- [ ] **Step 2: CONFIGS に登録**

`pipeline/run.ts` の現在の行:

```ts
const CONFIGS: Record<string, AssetConfig> = { btc: btcConfig, eth: ethConfig };
```

を次に置換:

```ts
const CONFIGS: Record<string, AssetConfig> = { btc: btcConfig, eth: ethConfig, xrp: xrpConfig, sol: solConfig };
```

- [ ] **Step 3: 型チェックと pipeline 全テスト**

Run: `npx tsc --noEmit && npx vitest run pipeline`
Expected: 型エラーなし・pipeline 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add pipeline/run.ts
git commit -m "feat(pipeline): run.tsにXRP・SOLを登録"
```

---

### Task 7: 公式アイコンを同梱

**Files:**
- Create: `public/icons/xrp.svg`, `public/icons/sol.svg`

- [ ] **Step 1: cryptocurrency-icons から取得して同梱**

（`node_modules/cryptocurrency-icons` が無ければ先に `npm install --no-save cryptocurrency-icons` を実行）

```bash
cp node_modules/cryptocurrency-icons/svg/color/xrp.svg public/icons/xrp.svg
cp node_modules/cryptocurrency-icons/svg/color/sol.svg public/icons/sol.svg
ls public/icons/
```
Expected: `btc.svg eth.svg sol.svg xrp.svg`

- [ ] **Step 2: コミット**

```bash
git add public/icons/xrp.svg public/icons/sol.svg
git commit -m "feat(site): XRP・SOLの公式アイコンを同梱"
```

---

### Task 8: サイト categories に XRP・SOL を登録

**Files:**
- Modify: `lib/categories.ts`（`CATEGORIES` 配列末尾に2件追加）

- [ ] **Step 1: 2件を追加**

`lib/categories.ts` の `CATEGORIES` 配列の `eth` エントリ（末尾の `}` と `];` の間）の後に追加:

```ts
  {
    slug: 'xrp',
    label: 'XRP ナラティブ',
    short: 'XRP',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: '✕',
    accent: 'var(--accent)',
    ogAccent: '#7e8a99',
  },
  {
    slug: 'sol',
    label: 'Solana ナラティブ',
    short: 'SOL',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: '◎',
    accent: 'var(--accent)',
    ogAccent: '#66f9a1',
  },
```

- [ ] **Step 2: ビルドで静的生成を確認**

Run: `npm run build 2>&1 | grep -E "/c/|/og/"`
Expected: `/c/xrp`・`/c/sol`・`/og/xrp`・`/og/sol` が生成される

- [ ] **Step 3: コミット**

```bash
git add lib/categories.ts
git commit -m "feat(site): XRP・SOL分野をcategoriesに登録"
```

---

### Task 9: 全体検証（テスト・型・ビルド・ドライラン）

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト・型・ビルド**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: 全テスト PASS・型エラーなし・ビルド成功（BTC/ETH 回帰なし）

- [ ] **Step 2: ドライラン（XRP）**

Run: `OLLAMA_API_KEY=dummy npx tsx pipeline/run.ts xrp --no-publish 2>&1 | head -40`
Expected: notes でデータ取得状況を確認。市場（CoinGecko）とオンチェーン（CoinMetrics: MVRV/活動アドレス）が取得できていること。
注: `OLLAMA_API_KEY=dummy` のため LLM 呼び出しでエラー終了は想定内。**データ取得段階の notes** を確認するのが目的。Coinalyze/Santiment はローカル鍵が無ければ notes に失敗記録が出る（CI/本番で取得される）。

- [ ] **Step 3: ドライラン（SOL）**

Run: `OLLAMA_API_KEY=dummy npx tsx pipeline/run.ts sol --no-publish 2>&1 | head -40`
Expected: オンチェーン（DefiLlama-chain: チェーンTVL/DEX出来高/手数料）が取得できていること。

- [ ] **Step 4: 視覚確認（任意・dev server）**

`npm run dev` 起動後、`/c/xrp`・`/c/sol`・`/og/xrp`・`/og/sol` を開き、公式アイコンが焦点表示されること、SiteNav に XRP/SOL が出ることを確認（特に XRP は暗色円＋白ロゴのため、ダーク背景での視認性を目視）。気になる場合は `ogAccent` や見え方を調整。

- [ ] **Step 5: 最終確認メモ**

以下は本番（GitHub Actions / cron）でのみ検証可能なため、ユーザーに引き継ぐ:
- Coinalyze の XRP/SOL シンボルが実際に funding/OI/L-S を返すか（本番 workflow_dispatch のログ・記事で確認）。
- cron-job.org に XRP（`30 */6`）・SOL（`45 */6`）ジョブ追加（body `{"ref":"main","inputs":{"asset":"xrp"|"sol"}}`、PATは既存再利用）。

---

## Self-Review

- **Spec coverage:** defillama-chain源(Task1,2)・XRP config/CoinMetrics(Task3,4)・SOL config(Task5)・run登録(Task6)・アイコン(Task7)・categories(Task8)・検証＋cron引き継ぎ(Task9) → spec全節を網羅。
- **Placeholder scan:** 各stepに実コード・実コマンド・期待値あり。プレースホルダなし。
- **Type consistency:** `parseDefiLlamaChain(tvl,dex,fees,asof)` の引数順はTask1定義とfetch呼び出しで一致。`AssetConfig.defillamaChain` はTask1で追加しTask5で使用。`onchainSource` unionにTask1で `'defillama-chain'` を追加しTask2/Task5で使用。`fetchDefiLlamaChain(cfg,notes)` シグネチャはTask1定義とTask2呼び出しで一致。
