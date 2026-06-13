# GitHub Actions × nemotron 自動公開パイプライン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BTCナラティブ6h分析記事を、GitHub Actions（無料枠・PC非依存）上で6ソースのRESTデータを取得し nemotron-3-ultra:cloud に執筆させて自動公開するパイプラインを、config駆動で汎用化しつつBTCのみ実装する。

**Architecture:** 決定論的TypeScriptパイプライン（`pipeline/`）が config を読み6ソースをREST取得 → 方法論ルール＋データ＋直近5本の切り口を結合したプロンプトを nemotron に1回投げ → 記事mdとINDEX追記を生成。各fetchモジュールは「HTTP取得関数」＋「純粋なparse関数」に分離し、parse関数をfixtureでユニットテストする。GitHub Actions が cron で `run.ts btc` を実行し、Phase 1はPR/ブランチ出力、Phase 2でmain直publishへ切替。

**Tech Stack:** TypeScript / tsx（Action内実行）/ vitest（テスト）/ Node 24 fetch（HTTP）/ GitHub Actions / Ollama Cloud API。既存 `lib/index-parser.ts` を再利用。

---

## 関連ドキュメント（着手前に読む）

- 設計仕様: `docs/superpowers/specs/2026-06-13-github-actions-nemotron-pipeline-design.md`
- 方法論: `runbook.md` §1（ガードレール）/§2（各ソース取得詳細）/§3（早見表）/§4（記事フォーマット・品質ルール）/§7（リモート手順のcurl実体）/§8（用語メモ）/§9（カテゴリ命名）
- 記事雛形: `articles/_template.md`
- INDEX形式: `articles/INDEX.md`（列: `配信日時(JST) | サイクル | 支配的ナラティブ | 強度(前回比) | 主要データ | ファイル`）

## ファイル構成（責務マップ）

| ファイル | 責務 |
|---|---|
| `pipeline/types.ts` | 全モジュール共通の型（`AssetConfig`, `MarketData`, `OnchainData`, `TrendWord`, `PositionData`, `OddsData`, `StableData`, `FetchBundle`, `SourceNote`） |
| `pipeline/config/btc.ts` | BTC銘柄config（各ソースのid/symbol/endpoint断片・出力パス・category・baseline） |
| `pipeline/fetch/coingecko.ts` | 市場（価格/24h/7d/30d/ATH/ドミナンス/セクター）。`parseCoinGecko`＋`fetchCoinGecko` |
| `pipeline/fetch/glassnode.ts` | オンチェーン（MVRV-Z/SOPR/LTH供給）。`parseGlassnodeMetric`＋`fetchGlassnode` |
| `pipeline/fetch/santiment.ts` | 言説（getTrendingWords）。`parseSantiment`＋`fetchSantiment` |
| `pipeline/fetch/coinalyze.ts` | ポジション（funding/OI/LS比）。`parseCoinalyze*`＋`fetchCoinalyze` |
| `pipeline/fetch/polymarket.ts` | 予測市場（年末オッズ）。`parsePolymarket`＋`fetchPolymarket` |
| `pipeline/fetch/defillama.ts` | ステーブル総供給＋W/W。`parseDefiLlama`＋`fetchDefiLlama` |
| `pipeline/build-prompt.ts` | データ＋方法論＋直近5本→nemotronプロンプト文字列（純関数） |
| `pipeline/generate.ts` | Ollama Cloud `/api/chat` 呼び出し（nemotron, think:true） |
| `pipeline/publish.ts` | 記事md書き出し＋INDEX.md追記＋重複チェック |
| `pipeline/run.ts` | オーケストレータ（config読込→並列fetch→prompt→generate→publish、`--no-publish`対応） |
| `pipeline/lib/recent.ts` | `getIndexRows()`（既存）から直近N本の `narrative` を取り出すヘルパ |
| `.github/workflows/publish-btc.yml` | cron＋workflow_dispatch。Phase1=PR出力 / Phase2=main push |
| `vitest.config.ts` | テスト設定（無ければ作成） |

各fetchモジュールは **純粋な `parseX(raw)` を必ず分離**し、テストは parse を対象にする（HTTPは薄いラッパ）。

---

## Phase 0: 事前準備（手動・コード前）

### Task 0a: Glassnode REST 認証要件の確定

**目的:** 仕様§11の唯一の未確定点を潰す。

- [ ] **Step 1: Glassnode無料/既存キーで対象メトリクスが取得可能か確認**

ローカルで（キーがあれば `.env` の値を使い）以下を叩く。キーが無ければ Glassnode アカウントでAPIキーを発行してから実行。

Run:
```bash
set +x; source ./.env 2>/dev/null
for m in market/mvrv_z_score indicators/sopr supply/lth_sum market/price_usd_close; do
  echo "== $m =="
  curl -s "https://api.glassnode.com/v1/metrics/$m?a=BTC&i=24h&api_key=${GLASSNODE_API_KEY}" | head -c 200; echo
done
```
Expected: 各メトリクスが `[{"t":...,"v":...}, ...]` のJSON配列を返す（30日・日足）。

- [ ] **Step 2: 結果を記録**

取得できたメトリクスと、403/権限エラーになったメトリクスを仕様書§11に追記（チェックボックスで）。取得不可のメトリクスは「null扱い＋記事注記」で縮退する方針を確認（Task 5で実装）。`GLASSNODE_API_KEY` が必要なら Phase 0c のSecret一覧に含める。

### Task 0b: git履歴の最終secretスキャン（public化前提）

- [ ] **Step 1: 実鍵が履歴に無いことを確認**

Run:
```bash
git rev-list --all | while read c; do git grep -nIE '(Apikey [A-Za-z0-9]{20,}|api_key=[A-Za-z0-9]{20,}|SANTIMENT_API_KEY=[A-Za-z0-9]|COINALYZE_API_KEY=[A-Za-z0-9])' "$c" 2>/dev/null; done | grep -v '\.env\.example' | head
```
Expected: **出力なし**（＝実鍵の混入なし）。何か出たら public 化を止め、`git filter-repo` 等での履歴除去を別途計画する。

### Task 0c: Ollama APIキー発行とGitHub Secrets登録

- [ ] **Step 1:** `https://ollama.com/settings/keys` で APIキーを発行。
- [ ] **Step 2:** GitHubリポジトリの Settings → Secrets and variables → Actions に登録:
  - `OLLAMA_API_KEY`（必須）
  - `SANTIMENT_API_KEY`（必須）
  - `COINALYZE_API_KEY`（必須）
  - `GLASSNODE_API_KEY`（Task 0aで必要と判明した場合）
  - `COINGECKO_API_KEY`（任意。demoキーがあればレート制限緩和）
- [ ] **Step 3:** 登録名のメモを `docs/superpowers/specs/...design.md` §7に反映。

> Phase 0 はコードを伴わないため commit 不要（仕様書追記分のみ commit）。

---

## Phase 1: パイプライン構築（main非公開で検証）

### Task 1: プロジェクト雛形とテスト基盤

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `pipeline/.gitkeep`

- [ ] **Step 1: 開発依存を追加**

Run:
```bash
npm install -D vitest tsx
```
Expected: `package.json` の devDependencies に `vitest` と `tsx` が入る。

- [ ] **Step 2: npm scripts を追加**

`package.json` の `"scripts"` に以下を追記（既存scriptは残す）:
```json
"test:pipeline": "vitest run pipeline",
"pipeline:btc": "tsx pipeline/run.ts btc"
```

- [ ] **Step 3: vitest設定を作成**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['pipeline/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: ディレクトリ確保**

Run: `mkdir -p pipeline/config pipeline/fetch pipeline/lib pipeline/__fixtures__ && touch pipeline/.gitkeep`

- [ ] **Step 5: 動作確認**

Run: `npx vitest run pipeline`
Expected: テスト0件で正常終了（"No test files found" でもexit 0扱い）。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts pipeline/.gitkeep
git commit -m "chore(pipeline): scaffold pipeline dir, add vitest+tsx"
```

### Task 2: 共通型定義

**Files:**
- Create: `pipeline/types.ts`

- [ ] **Step 1: 型を定義**

Create `pipeline/types.ts`:
```ts
// 取得失敗の記録（記事冒頭注記に使う）
export type SourceNote = { source: string; message: string };

export type MarketData = {
  price_usd: number;
  chg_24h: number; chg_7d: number; chg_30d: number;
  ath: number; ath_change_pct: number; ath_date: string;
  btc_dominance: number;
  total_mcap_chg_24h: number;
  sectors_top: { name: string; chg24h: number }[];
};

export type OnchainData = {
  mvrv_z: number | null;
  sopr: number | null;
  lth_sum: number | null;
  asof: string | null; // 最新データ点の日付(UTC)
};

export type TrendWord = { word: string; score: number };

export type PositionData = {
  funding: { symbol: string; pct: number }[]; // value*100
  oi_usd: number | null;
  ls_long_pct: number | null; // long%
};

export type OddsData = {
  // ターゲット価格→到達確率%。例 { "55000": 54.5, "100000": 17.5 }
  targets: Record<string, number>;
  market_slug: string;
};

export type StableData = {
  total_usd: number;          // 最新 totalCirculatingUSD.peggedUSD
  wow_change_pct: number | null; // 約7日前比
};

export type FetchBundle = {
  market: MarketData | null;
  onchain: OnchainData | null;
  trends: TrendWord[] | null;
  positions: PositionData | null;
  odds: OddsData | null;
  stables: StableData | null;
  notes: SourceNote[];
};

export type AssetConfig = {
  key: string;            // 'btc'（ファイル名接尾辞・runbook §9）
  cycle: string;          // '6h'
  coingeckoId: string;    // 'bitcoin'
  glassnodeAsset: string; // 'BTC'
  santimentSize: number;  // 12
  coinalyzeSymbols: string;
  polymarketSlug: string; // 'what-price-will-bitcoin-hit-before-2027'
  oddsTargets: string[];  // ['55000','50000','45000','100000','120000']
  baselineAth: number;    // 126080
  baselineAthDate: string;// '2025-10-06'
  outputDir: string;      // 'articles'
  promptIntro: string;    // 銘柄固有の導入（build-promptで使用）
};
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS（型エラーなし。`pipeline/types.ts` は型のみ）。

- [ ] **Step 3: Commit**

```bash
git add pipeline/types.ts
git commit -m "feat(pipeline): add shared types"
```

### Task 3: BTC config

**Files:**
- Create: `pipeline/config/btc.ts`
- Test: `pipeline/config/btc.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `pipeline/config/btc.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { btcConfig } from './btc';

describe('btcConfig', () => {
  it('has BTC identifiers and baseline', () => {
    expect(btcConfig.key).toBe('btc');
    expect(btcConfig.coingeckoId).toBe('bitcoin');
    expect(btcConfig.glassnodeAsset).toBe('BTC');
    expect(btcConfig.baselineAth).toBe(126080);
    expect(btcConfig.oddsTargets).toContain('55000');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run pipeline/config/btc.test.ts`
Expected: FAIL（`Cannot find module './btc'`）。

- [ ] **Step 3: configを実装**

Create `pipeline/config/btc.ts`:
```ts
import type { AssetConfig } from '../types';

export const btcConfig: AssetConfig = {
  key: 'btc',
  cycle: '6h',
  coingeckoId: 'bitcoin',
  glassnodeAsset: 'BTC',
  santimentSize: 12,
  coinalyzeSymbols:
    'BTCUSDT_PERP.A,BTCUSD_PERP.A,BTC-PERPETUAL.2,BTCUSDT_PERP.4,BTCUSDT_PERP.F',
  polymarketSlug: 'what-price-will-bitcoin-hit-before-2027',
  oddsTargets: ['55000', '50000', '45000', '100000', '120000'],
  baselineAth: 126080,
  baselineAthDate: '2025-10-06',
  outputDir: 'articles',
  promptIntro:
    'BTC（ビットコイン）の6hナラティブ分析。市場参加者がBTCをどう語っているか、その語り口の変化を構造分析する。',
};
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run pipeline/config/btc.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add pipeline/config/btc.ts pipeline/config/btc.test.ts
git commit -m "feat(pipeline): add BTC asset config"
```

### Task 4: CoinGecko fetch（市場）

**Files:**
- Create: `pipeline/fetch/coingecko.ts`
- Create: `pipeline/__fixtures__/coingecko.json`
- Test: `pipeline/fetch/coingecko.test.ts`

REST: `GET https://api.coingecko.com/api/v3/coins/{id}?localization=false&tickers=false&market_data=true&community_data=false`、`GET /api/v3/global`、`GET /api/v3/coins/categories?order=market_cap_change_24h_desc`。任意で header `x-cg-demo-api-key`。

- [ ] **Step 1: fixtureを作成**

Create `pipeline/__fixtures__/coingecko.json`（最小形）:
```json
{
  "coin": { "market_data": {
    "current_price": { "usd": 63631 },
    "price_change_percentage_24h": 1.05,
    "price_change_percentage_7d": 2.68,
    "price_change_percentage_30d": -20.94,
    "ath": { "usd": 126080 },
    "ath_change_percentage": { "usd": -49.53 },
    "ath_date": { "usd": "2025-10-06T18:57:42.558Z" }
  }},
  "global": { "data": {
    "market_cap_percentage": { "btc": 56.39 },
    "market_cap_change_percentage_24h_usd": 0.85
  }},
  "categories": [
    { "name": "ERC 404", "market_cap_change_24h": 64.8 },
    { "name": "Arcade Games", "market_cap_change_24h": 37.4 },
    { "name": "A", "market_cap_change_24h": 5 },
    { "name": "B", "market_cap_change_24h": 4 },
    { "name": "C", "market_cap_change_24h": 3 },
    { "name": "D", "market_cap_change_24h": 2 }
  ]
}
```

- [ ] **Step 2: 失敗するテストを書く**

Create `pipeline/fetch/coingecko.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCoinGecko } from './coingecko';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/coingecko.json'), 'utf8'),
);

describe('parseCoinGecko', () => {
  it('extracts market fields and top-5 sectors', () => {
    const m = parseCoinGecko(raw.coin, raw.global, raw.categories);
    expect(m.price_usd).toBe(63631);
    expect(m.btc_dominance).toBe(56.39);
    expect(m.ath).toBe(126080);
    expect(m.sectors_top).toHaveLength(5);
    expect(m.sectors_top[0].name).toBe('ERC 404');
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run pipeline/fetch/coingecko.test.ts`
Expected: FAIL（`parseCoinGecko` 未定義）。

- [ ] **Step 4: 実装**

Create `pipeline/fetch/coingecko.ts`:
```ts
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
```

- [ ] **Step 5: 成功を確認**

Run: `npx vitest run pipeline/fetch/coingecko.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add pipeline/fetch/coingecko.ts pipeline/fetch/coingecko.test.ts pipeline/__fixtures__/coingecko.json
git commit -m "feat(pipeline): coingecko market fetch+parse"
```

### Task 5: Glassnode fetch（オンチェーン・縮退対応）

**Files:**
- Create: `pipeline/fetch/glassnode.ts`
- Create: `pipeline/__fixtures__/glassnode_mvrv.json`
- Test: `pipeline/fetch/glassnode.test.ts`

REST: `GET https://api.glassnode.com/v1/metrics/{path}?a=BTC&i=24h&api_key=KEY` → `[{t,v}, ...]`。取得不可メトリクスは `null`＋note。

- [ ] **Step 1: fixtureを作成**

Create `pipeline/__fixtures__/glassnode_mvrv.json`:
```json
[{ "t": 1749513600, "v": 0.271 }, { "t": 1749600000, "v": 0.344 }]
```

- [ ] **Step 2: 失敗するテストを書く**

Create `pipeline/fetch/glassnode.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlassnodeMetric } from './glassnode';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/glassnode_mvrv.json'), 'utf8'),
);

describe('parseGlassnodeMetric', () => {
  it('returns the latest value and its UTC date', () => {
    const p = parseGlassnodeMetric(raw);
    expect(p.value).toBe(0.344);
    expect(p.asof).toMatch(/^2025-06-11|^\d{4}-\d{2}-\d{2}$/);
  });
  it('returns null for empty array', () => {
    expect(parseGlassnodeMetric([]).value).toBeNull();
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run pipeline/fetch/glassnode.test.ts`
Expected: FAIL（`parseGlassnodeMetric` 未定義）。

- [ ] **Step 4: 実装**

Create `pipeline/fetch/glassnode.ts`:
```ts
import type { OnchainData, AssetConfig, SourceNote } from '../types';

type Point = { t: number; v: number };

export function parseGlassnodeMetric(raw: Point[]): {
  value: number | null; asof: string | null;
} {
  if (!Array.isArray(raw) || raw.length === 0) return { value: null, asof: null };
  const last = raw[raw.length - 1];
  return {
    value: last.v,
    asof: new Date(last.t * 1000).toISOString().slice(0, 10),
  };
}

const METRICS: Record<keyof Omit<OnchainData, 'asof'>, string> = {
  mvrv_z: 'market/mvrv_z_score',
  sopr: 'indicators/sopr',
  lth_sum: 'supply/lth_sum',
};

export async function fetchGlassnode(
  cfg: AssetConfig, notes: SourceNote[],
): Promise<OnchainData> {
  const key = process.env.GLASSNODE_API_KEY ?? '';
  const out: OnchainData = { mvrv_z: null, sopr: null, lth_sum: null, asof: null };
  for (const [field, path] of Object.entries(METRICS) as [keyof typeof METRICS, string][]) {
    try {
      const url = `https://api.glassnode.com/v1/metrics/${path}?a=${cfg.glassnodeAsset}&i=24h&api_key=${key}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const parsed = parseGlassnodeMetric(await res.json());
      out[field] = parsed.value;
      if (parsed.asof) out.asof = parsed.asof;
    } catch (e) {
      notes.push({ source: 'Glassnode', message: `${path}: ${(e as Error).message}` });
    }
  }
  return out;
}
```

- [ ] **Step 5: 成功を確認**

Run: `npx vitest run pipeline/fetch/glassnode.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add pipeline/fetch/glassnode.ts pipeline/fetch/glassnode.test.ts pipeline/__fixtures__/glassnode_mvrv.json
git commit -m "feat(pipeline): glassnode onchain fetch with graceful degrade"
```

### Task 6: Santiment fetch（言説）

**Files:**
- Create: `pipeline/fetch/santiment.ts`
- Create: `pipeline/__fixtures__/santiment.json`
- Test: `pipeline/fetch/santiment.test.ts`

REST: `POST https://api.santiment.net/graphql`、header `Authorization: Apikey KEY`、body `getTrendingWords(size, from:"utc_now-2d", to:"utc_now", interval:"1d")`。最新datetimeの topWords を採用。

- [ ] **Step 1: fixtureを作成**

Create `pipeline/__fixtures__/santiment.json`:
```json
{ "data": { "getTrendingWords": [
  { "datetime": "2026-06-12T00:00:00Z", "topWords": [
    { "word": "old", "score": 1 } ] },
  { "datetime": "2026-06-13T00:00:00Z", "topWords": [
    { "word": "spacex", "score": 1004 }, { "word": "ipo", "score": 798 } ] }
]}}
```

- [ ] **Step 2: 失敗するテストを書く**

Create `pipeline/fetch/santiment.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSantiment } from './santiment';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/santiment.json'), 'utf8'),
);

describe('parseSantiment', () => {
  it('returns the latest datetime bucket words sorted by score desc', () => {
    const words = parseSantiment(raw);
    expect(words[0].word).toBe('spacex');
    expect(words[0].score).toBe(1004);
    expect(words).toHaveLength(2);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run pipeline/fetch/santiment.test.ts`
Expected: FAIL。

- [ ] **Step 4: 実装**

Create `pipeline/fetch/santiment.ts`:
```ts
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
```

- [ ] **Step 5: 成功を確認**

Run: `npx vitest run pipeline/fetch/santiment.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add pipeline/fetch/santiment.ts pipeline/fetch/santiment.test.ts pipeline/__fixtures__/santiment.json
git commit -m "feat(pipeline): santiment trending words fetch+parse"
```

### Task 7: Coinalyze fetch（ポジション）

**Files:**
- Create: `pipeline/fetch/coinalyze.ts`
- Create: `pipeline/__fixtures__/coinalyze_funding.json`, `pipeline/__fixtures__/coinalyze_ls.json`
- Test: `pipeline/fetch/coinalyze.test.ts`

REST（要 `COINALYZE_API_KEY`）: `funding-rate?symbols=...`、`open-interest?convert_to_usd=true`、`long-short-ratio-history?symbols=BTCUSDT_PERP.A&interval=1hour&from=now-21600&to=now`（fields t/r/l/s）。funding `value` は ×100 で%。

- [ ] **Step 1: fixtureを作成**

Create `pipeline/__fixtures__/coinalyze_funding.json`:
```json
[{ "symbol": "BTCUSDT_PERP.A", "value": 0.000024 },
 { "symbol": "BTC-PERPETUAL.2", "value": -0.000064 }]
```
Create `pipeline/__fixtures__/coinalyze_ls.json`:
```json
[{ "symbol": "BTCUSDT_PERP.A", "history": [
  { "t": 1, "r": 1.4, "l": 60.0, "s": 40.0 },
  { "t": 2, "r": 1.5, "l": 60.12, "s": 39.88 } ] }]
```

- [ ] **Step 2: 失敗するテストを書く**

Create `pipeline/fetch/coinalyze.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFunding, parseLongShort } from './coinalyze';

const f = (n: string) =>
  JSON.parse(readFileSync(join(__dirname, `../__fixtures__/${n}`), 'utf8'));

describe('parseFunding', () => {
  it('converts value to percent', () => {
    const out = parseFunding(f('coinalyze_funding.json'));
    expect(out[0].symbol).toBe('BTCUSDT_PERP.A');
    expect(out[0].pct).toBeCloseTo(0.0024, 4);
  });
});

describe('parseLongShort', () => {
  it('returns latest long%', () => {
    expect(parseLongShort(f('coinalyze_ls.json'))).toBe(60.12);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run pipeline/fetch/coinalyze.test.ts`
Expected: FAIL。

- [ ] **Step 4: 実装**

Create `pipeline/fetch/coinalyze.ts`:
```ts
import type { PositionData, AssetConfig, SourceNote } from '../types';

export function parseFunding(raw: { symbol: string; value: number }[]) {
  return raw.map((r) => ({ symbol: r.symbol, pct: r.value * 100 }));
}

export function parseOpenInterest(raw: { value: number }[]): number | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.reduce((sum, r) => sum + (r.value ?? 0), 0);
}

export function parseLongShort(
  raw: { symbol: string; history: { t: number; l: number }[] }[],
): number | null {
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
    out.funding = parseFunding(await r.json());
  } catch (e) { notes.push({ source: 'Coinalyze', message: `funding: ${(e as Error).message}` }); }
  try {
    const r = await fetch(`${base}/open-interest?api_key=${key}&symbols=${cfg.coinalyzeSymbols}&convert_to_usd=true`);
    out.oi_usd = parseOpenInterest(await r.json());
  } catch (e) { notes.push({ source: 'Coinalyze', message: `oi: ${(e as Error).message}` }); }
  try {
    const r = await fetch(`${base}/long-short-ratio-history?api_key=${key}&symbols=BTCUSDT_PERP.A&interval=1hour&from=${now - 21600}&to=${now}`);
    out.ls_long_pct = parseLongShort(await r.json());
  } catch (e) { notes.push({ source: 'Coinalyze', message: `ls: ${(e as Error).message}` }); }
  return out;
}
```

- [ ] **Step 5: 成功を確認**

Run: `npx vitest run pipeline/fetch/coinalyze.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add pipeline/fetch/coinalyze.ts pipeline/fetch/coinalyze.test.ts pipeline/__fixtures__/coinalyze_funding.json pipeline/__fixtures__/coinalyze_ls.json
git commit -m "feat(pipeline): coinalyze positions fetch+parse"
```

### Task 8: Polymarket fetch（予測市場）

**Files:**
- Create: `pipeline/fetch/polymarket.ts`
- Create: `pipeline/__fixtures__/polymarket.json`
- Test: `pipeline/fetch/polymarket.test.ts`

REST（鍵不要）: `GET https://gamma-api.polymarket.com/public-search?q=bitcoin&limit_per_type=8` でイベント探索 → 対象イベント（slug一致）の markets から各ターゲット価格の確率（outcomePrices）を抽出。実レスポンスはネスト深いため、parseはfixtureに合わせて確率マップを返す純関数にする。

- [ ] **Step 1: fixtureを作成**

Create `pipeline/__fixtures__/polymarket.json`（正規化済みの最小形を想定）:
```json
{ "events": [
  { "slug": "what-price-will-bitcoin-hit-before-2027", "markets": [
    { "groupItemTitle": "$55,000", "outcomePrices": ["0.545", "0.455"] },
    { "groupItemTitle": "$100,000", "outcomePrices": ["0.175", "0.825"] }
  ]}
]}
```

- [ ] **Step 2: 失敗するテストを書く**

Create `pipeline/fetch/polymarket.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePolymarket } from './polymarket';
import { btcConfig } from '../config/btc';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/polymarket.json'), 'utf8'),
);

describe('parsePolymarket', () => {
  it('maps target price to YES probability percent', () => {
    const odds = parsePolymarket(raw, btcConfig);
    expect(odds.targets['55000']).toBeCloseTo(54.5, 1);
    expect(odds.targets['100000']).toBeCloseTo(17.5, 1);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run pipeline/fetch/polymarket.test.ts`
Expected: FAIL。

- [ ] **Step 4: 実装**

Create `pipeline/fetch/polymarket.ts`:
```ts
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
  // public-search はイベント概要のみ。詳細は events エンドポイントで slug 指定取得。
  const res = await fetch(
    `https://gamma-api.polymarket.com/events?slug=${cfg.polymarketSlug}`,
  );
  if (!res.ok) throw new Error(`Polymarket -> ${res.status}`);
  const events = await res.json();
  return parsePolymarket({ events }, cfg);
}
```
> 注: `fetchPolymarket` の実レスポンス形は実装時に1度叩いて確認し、`parsePolymarket` のfixture形に正規化するアダプタを `fetch` 側に置く（parseの純粋性は保つ）。スキーマ差異が出たらfixtureとparseを実形に合わせて更新。

- [ ] **Step 5: 成功を確認**

Run: `npx vitest run pipeline/fetch/polymarket.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add pipeline/fetch/polymarket.ts pipeline/fetch/polymarket.test.ts pipeline/__fixtures__/polymarket.json
git commit -m "feat(pipeline): polymarket year-end odds fetch+parse"
```

### Task 9: DefiLlama fetch（ステーブル総供給）

**Files:**
- Create: `pipeline/fetch/defillama.ts`
- Create: `pipeline/__fixtures__/defillama.json`
- Test: `pipeline/fetch/defillama.test.ts`

REST（鍵不要）: `GET https://stablecoins.llama.fi/stablecoincharts/all` → 配列 `[{date, totalCirculatingUSD:{peggedUSD}}, ...]`。最新を総供給、約7日前（7点前）からW/W。

- [ ] **Step 1: fixtureを作成**

Create `pipeline/__fixtures__/defillama.json`:
```json
[
  { "date": "1748908800", "totalCirculatingUSD": { "peggedUSD": 315000000000 } },
  { "date": "1749513600", "totalCirculatingUSD": { "peggedUSD": 313340000000 } }
]
```

- [ ] **Step 2: 失敗するテストを書く**

Create `pipeline/fetch/defillama.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDefiLlama } from './defillama';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/defillama.json'), 'utf8'),
);

describe('parseDefiLlama', () => {
  it('takes latest total and computes W/W vs ~7 points earlier', () => {
    const s = parseDefiLlama(raw);
    expect(s.total_usd).toBe(313340000000);
    expect(s.wow_change_pct).toBeCloseTo(-0.527, 1);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run pipeline/fetch/defillama.test.ts`
Expected: FAIL。

- [ ] **Step 4: 実装**

Create `pipeline/fetch/defillama.ts`:
```ts
import type { StableData } from '../types';

type Point = { date: string; totalCirculatingUSD: { peggedUSD: number } };

export function parseDefiLlama(raw: Point[]): StableData {
  if (!Array.isArray(raw) || raw.length === 0) return { total_usd: 0, wow_change_pct: null };
  const latest = raw[raw.length - 1].totalCirculatingUSD.peggedUSD;
  const prevIdx = Math.max(0, raw.length - 8); // 約7日前（日足想定）
  const prev = raw[prevIdx].totalCirculatingUSD.peggedUSD;
  const wow = prev ? ((latest - prev) / prev) * 100 : null;
  return { total_usd: latest, wow_change_pct: wow };
}

export async function fetchDefiLlama(): Promise<StableData> {
  const res = await fetch('https://stablecoins.llama.fi/stablecoincharts/all');
  if (!res.ok) throw new Error(`DefiLlama -> ${res.status}`);
  return parseDefiLlama(await res.json());
}
```

- [ ] **Step 5: 成功を確認**

Run: `npx vitest run pipeline/fetch/defillama.test.ts`
Expected: PASS（fixtureは2点なので prevIdx=0、(313.34-315)/315*100≈-0.527）。

- [ ] **Step 6: Commit**

```bash
git add pipeline/fetch/defillama.ts pipeline/fetch/defillama.test.ts pipeline/__fixtures__/defillama.json
git commit -m "feat(pipeline): defillama stablecoin supply fetch+parse"
```

### Task 10: 直近N本ヘルパ

**Files:**
- Create: `pipeline/lib/recent.ts`
- Test: `pipeline/lib/recent.test.ts`

既存 `lib/index-parser.ts` の `getIndexRows()`（newest先頭）を使い、直近N本の `narrative`（支配ナラティブ＝切り口）を返す。

- [ ] **Step 1: 失敗するテストを書く**

Create `pipeline/lib/recent.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { recentNarratives } from './recent';
import type { IndexRow } from '../../lib/index-parser';

const rows: IndexRow[] = Array.from({ length: 8 }, (_, i) => ({
  datetime: `d${i}`, cycle: '6h', narrative: `n${i}`, strength: 1,
  strengthDelta: '±0', keyData: 'k', slug: `s${i}`,
}));

describe('recentNarratives', () => {
  it('returns first N narratives', () => {
    expect(recentNarratives(rows, 5)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run pipeline/lib/recent.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装**

Create `pipeline/lib/recent.ts`:
```ts
import type { IndexRow } from '../../lib/index-parser';
import { getIndexRows } from '../../lib/index-parser';

export function recentNarratives(rows: IndexRow[], n: number): string[] {
  return rows.slice(0, n).map((r) => r.narrative);
}

export function loadRecentNarratives(n: number): string[] {
  return recentNarratives(getIndexRows(), n);
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run pipeline/lib/recent.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add pipeline/lib/recent.ts pipeline/lib/recent.test.ts
git commit -m "feat(pipeline): recent narratives helper (reuse index-parser)"
```

### Task 11: build-prompt（純関数）

**Files:**
- Create: `pipeline/build-prompt.ts`
- Test: `pipeline/build-prompt.test.ts`

データ＋方法論ルール（runbook §1/§4要約）＋直近5本→nemotronプロンプト文字列。純関数（FetchBundle, recentNarratives[], AssetConfig, asofJST を受ける）。

- [ ] **Step 1: 失敗するテストを書く**

Create `pipeline/build-prompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildPrompt } from './build-prompt';
import { btcConfig } from './config/btc';
import type { FetchBundle } from './types';

const bundle: FetchBundle = {
  market: { price_usd: 63631, chg_24h: 1.05, chg_7d: 2.68, chg_30d: -20.94,
    ath: 126080, ath_change_pct: -49.53, ath_date: '2025-10-06', btc_dominance: 56.39,
    total_mcap_chg_24h: 0.85, sectors_top: [{ name: 'ERC 404', chg24h: 64.8 }] },
  onchain: { mvrv_z: 0.344, sopr: 0.988, lth_sum: 14909761, asof: '2026-06-11' },
  trends: [{ word: 'spacex', score: 1004 }],
  positions: { funding: [{ symbol: 'BTCUSDT_PERP.A', pct: 0.0024 }], oi_usd: 6.29e9, ls_long_pct: 60.12 },
  odds: { targets: { '55000': 54.5 }, market_slug: 'x' },
  stables: { total_usd: 313.34e9, wow_change_pct: -0.58 },
  notes: [],
};

describe('buildPrompt', () => {
  it('includes methodology guardrails, data, recent angles, and baseline', () => {
    const p = buildPrompt(bundle, ['前回の切り口A'], btcConfig, '2026-06-13 15:06');
    expect(p).toContain('価格予想'); // ガードレール（断定・価格予想禁止）
    expect(p).toContain('126080');   // ベースラインATH
    expect(p).toContain('63631');    // 価格
    expect(p).toContain('spacex');   // トレンド語
    expect(p).toContain('前回の切り口A'); // 重複回避用の直近切り口
    expect(p).toContain('⚠️ 自動生成｜6ソース'); // 冒頭注記指示
  });

  it('lists source failures when notes present', () => {
    const p = buildPrompt({ ...bundle, notes: [{ source: 'Coinalyze', message: 'oi: 500' }] },
      [], btcConfig, '2026-06-13 15:06');
    expect(p).toContain('取得失敗');
    expect(p).toContain('Coinalyze');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run pipeline/build-prompt.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装**

Create `pipeline/build-prompt.ts`:
```ts
import type { FetchBundle, AssetConfig } from './types';

const GUARDRAILS = `# 厳守ルール（runbook §1/§4）
1. スコア系（Fear&Greed, sentiment_balance等）を結論にしない。「どう語られているか」の構造で論じる。
2. ベースライン必須：基準ATH $126,080（2025-10-06）から見て今どこかを述べる。
3. 断定・価格予想・売買助言をしない。認知の歪みの指摘に留める。
4. 専門用語は初出時に括弧で一言補足（リテール向け・詰め込みすぎない）。
5. reflexivity（価格↔ナラティブの共変・リード/ラグ）を判定する。層（言説/ポジション/オンチェーン）の食い違いに注目。
6. タイトルは支配ナラティブを1行で。「〜号」「今号」「速報」等の自己言及・体裁語で締めない。
7. 末尾に免責文。`;

function fmtData(b: FetchBundle): string {
  const m = b.market, o = b.onchain, p = b.positions, s = b.stables;
  const lines: string[] = [];
  if (m) lines.push(`- 価格 $${m.price_usd}（24h ${m.chg_24h}% / 7d ${m.chg_7d}% / 30d ${m.chg_30d}%）ATH比 ${m.ath_change_pct}%（ATH $${m.ath} ${m.ath_date}）ドミナンス ${m.btc_dominance}%`);
  if (m) lines.push(`- 上昇セクター: ${m.sectors_top.map((x) => `${x.name}(${x.chg24h}%)`).join(', ')}`);
  if (o) lines.push(`- オンチェーン: MVRV-Z ${o.mvrv_z ?? 'N/A'} / SOPR ${o.sopr ?? 'N/A'} / LTH供給 ${o.lth_sum ?? 'N/A'}（asof ${o.asof ?? 'N/A'}）`);
  if (b.trends) lines.push(`- トレンド語: ${b.trends.map((w) => `${w.word}(${w.score})`).join(', ')}`);
  if (p) lines.push(`- ポジション: funding ${p.funding.map((f) => `${f.symbol}:${f.pct.toFixed(4)}%`).join(' / ')} / OI $${p.oi_usd ?? 'N/A'} / L/S long ${p.ls_long_pct ?? 'N/A'}%`);
  if (b.odds) lines.push(`- 年末オッズ: ${Object.entries(b.odds.targets).map(([k, v]) => `$${k}:${v}%`).join(' / ')}`);
  if (s) lines.push(`- ステーブル総供給 $${(s.total_usd / 1e9).toFixed(2)}B（W/W ${s.wow_change_pct?.toFixed(2) ?? 'N/A'}%）`);
  return lines.join('\n');
}

export function buildPrompt(
  bundle: FetchBundle, recentAngles: string[], cfg: AssetConfig, asofJST: string,
): string {
  const notesBlock = bundle.notes.length
    ? `\n# 取得失敗ソース（記事冒頭の注記に明記して続行）\n${bundle.notes.map((n) => `- ${n.source}: ${n.message}`).join('\n')}\n`
    : '';
  const recentBlock = recentAngles.length
    ? `\n# 直近の支配ナラティブ（これらと書き出し・比喩・切り口を被らせない）\n${recentAngles.map((a, i) => `${i + 1}. ${a.slice(0, 400)}`).join('\n')}\n`
    : '';
  return `あなたは「Narrative Broadcast」の書き手。${cfg.promptIntro}

${GUARDRAILS}

# 今サイクルの実データ（${asofJST} JST 取得）
${fmtData(bundle)}
${notesBlock}${recentBlock}
# 出力形式
- 冒頭に「> ⚠️ 自動生成｜6ソース」を置く。
- \`# タイトル\`（支配ナラティブを1行・煽らない）
- articles/_template.md の6h構成（現在の支配的ナラティブ / 構造分析[表層・中層・深層＋reflexivity] / 競合ナラティブ / 注目すべき変化点 / トレーダー視点の示唆[価格予想・売買助言禁止]）
- 末尾に免責文「※本記事は情報提供を目的としたものであり、投資助言ではありません。」

Markdownで記事本文のみを出力（説明文や前置きは不要）。`;
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run pipeline/build-prompt.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add pipeline/build-prompt.ts pipeline/build-prompt.test.ts
git commit -m "feat(pipeline): build nemotron prompt (methodology+data+recent angles)"
```

### Task 12: generate（Ollama Cloud 呼び出し）

**Files:**
- Create: `pipeline/generate.ts`
- Test: `pipeline/generate.test.ts`

`/api/chat`（nemotron-3-ultra:cloud, think:true）。レスポンス `message.content` を本文に。1回リトライ。テストは `fetch` をスタブして本文抽出とリトライ挙動を検証。

- [ ] **Step 1: 失敗するテストを書く**

Create `pipeline/generate.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { generateArticle } from './generate';

describe('generateArticle', () => {
  it('returns message.content from the API', async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '# T\n本文' } }),
    });
    const out = await generateArticle('PROMPT', { apiKey: 'k', fetchImpl: stub as any });
    expect(out).toContain('# T');
    expect(stub).toHaveBeenCalledOnce();
  });

  it('retries once on failure then succeeds', async () => {
    const stub = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: 'OK' } }) });
    const out = await generateArticle('P', { apiKey: 'k', fetchImpl: stub as any });
    expect(out).toBe('OK');
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('throws after second failure', async () => {
    const stub = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(generateArticle('P', { apiKey: 'k', fetchImpl: stub as any }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run pipeline/generate.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装**

Create `pipeline/generate.ts`:
```ts
type Opts = { apiKey: string; fetchImpl?: typeof fetch };

export async function generateArticle(prompt: string, opts: Opts): Promise<string> {
  const f = opts.fetchImpl ?? fetch;
  const body = JSON.stringify({
    model: 'nemotron-3-ultra:cloud',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    think: true,
  });
  const call = async () => {
    const res = await f('https://ollama.com/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`Ollama -> ${res.status}`);
    const data = await res.json();
    const content = data?.message?.content;
    if (!content || typeof content !== 'string') throw new Error('empty content');
    return content;
  };
  try {
    return await call();
  } catch {
    return await call(); // 1回リトライ。失敗すれば例外伝播
  }
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run pipeline/generate.test.ts`
Expected: PASS（3テスト）。

- [ ] **Step 5: Commit**

```bash
git add pipeline/generate.ts pipeline/generate.test.ts
git commit -m "feat(pipeline): ollama nemotron generate with one retry"
```

### Task 13: publish（書き出し＋INDEX追記）

**Files:**
- Create: `pipeline/publish.ts`
- Test: `pipeline/publish.test.ts`

記事mdを `articles/YYYY/MM/YYYY-MM-DD-HHmm-6h-<key>.md` に書き、INDEX.md 先頭データ行の上に1行追記。重複（同ファイル名既存）はスキップ。タイトル抽出は本文1行目の `# `。INDEX行の「主要データ」列は短い要約（価格・ドミナンス）を機械生成。

- [ ] **Step 1: 失敗するテストを書く**

Create `pipeline/publish.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildIndexRow, articleRelPath, extractTitle } from './publish';
import { btcConfig } from './config/btc';

describe('publish helpers', () => {
  it('extractTitle reads first markdown h1', () => {
    expect(extractTitle('> ⚠️ 自動生成｜6ソース\n# 半値の語り\n本文')).toBe('半値の語り');
  });
  it('articleRelPath builds dated path with category suffix', () => {
    const p = articleRelPath(btcConfig, new Date('2026-06-13T06:06:00Z'), 'Asia/Tokyo');
    expect(p).toBe('articles/2026/06/2026-06-13-1506-6h-btc.md');
  });
  it('buildIndexRow formats a pipe row with link', () => {
    const row = buildIndexRow({
      datetimeJst: '2026-06-13 15:06', cycle: '6h', title: '半値の語り',
      keyData: 'BTC$63,631・ドミナンス56.39%', slug: '2026/06/2026-06-13-1506-6h-btc',
    });
    expect(row.startsWith('| 2026-06-13 15:06 | 6h | 半値の語り |')).toBe(true);
    expect(row).toContain('[link](2026/06/2026-06-13-1506-6h-btc.md)');
    expect(row).toContain('1/10');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run pipeline/publish.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装**

Create `pipeline/publish.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { AssetConfig } from './types';

// Intl で JST の各パートを得る
function jstParts(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) if (part.type !== 'literal') p[part.type] = part.value;
  return p; // {year,month,day,hour,minute}
}

export function articleRelPath(cfg: AssetConfig, now: Date, tz = 'Asia/Tokyo'): string {
  const p = jstParts(now, tz);
  const name = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}-${cfg.cycle}-${cfg.key}.md`;
  return `${cfg.outputDir}/${p.year}/${p.month}/${name}`;
}

export function datetimeJst(now: Date, tz = 'Asia/Tokyo'): string {
  const p = jstParts(now, tz);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function extractTitle(md: string): string {
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (t.startsWith('# ')) return t.slice(2).trim();
  }
  return '(無題)';
}

export function buildIndexRow(o: {
  datetimeJst: string; cycle: string; title: string; keyData: string; slug: string;
}): string {
  return `| ${o.datetimeJst} | ${o.cycle} | ${o.title} | 1/10 (±0) | ${o.keyData} | [link](${o.slug}.md) |`;
}

// INDEX.md のヘッダ区切り行直後（最新行の位置）に row を挿入
export function insertIndexRow(indexMd: string, row: string): string {
  const lines = indexMd.split('\n');
  // テーブルヘッダの区切り行 '|---|...' を探し、その次行に挿入
  const sepIdx = lines.findIndex((l) => /^\|[-\s|]+\|$/.test(l.trim()));
  if (sepIdx === -1) return indexMd.trimEnd() + '\n' + row + '\n';
  lines.splice(sepIdx + 1, 0, row);
  return lines.join('\n');
}

export function publish(opts: {
  cfg: AssetConfig; markdown: string; keyData: string; now: Date; root: string;
}): { path: string; skipped: boolean } {
  const rel = articleRelPath(opts.cfg, opts.now);
  const abs = join(opts.root, rel);
  if (existsSync(abs)) return { path: rel, skipped: true };
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, opts.markdown, 'utf8');

  const indexPath = join(opts.root, opts.cfg.outputDir, 'INDEX.md');
  const indexMd = readFileSync(indexPath, 'utf8');
  const row = buildIndexRow({
    datetimeJst: datetimeJst(opts.now), cycle: opts.cfg.cycle,
    title: extractTitle(opts.markdown), keyData: opts.keyData,
    slug: rel.replace(`${opts.cfg.outputDir}/`, ''),
  });
  writeFileSync(indexPath, insertIndexRow(indexMd, row), 'utf8');
  return { path: rel, skipped: false };
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run pipeline/publish.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add pipeline/publish.ts pipeline/publish.test.ts
git commit -m "feat(pipeline): publish article + INDEX row insertion"
```

### Task 14: run オーケストレータ（`--no-publish`対応）

**Files:**
- Create: `pipeline/run.ts`
- Test: `pipeline/run.test.ts`（keyData要約関数のみユニット対象）

並列fetch（個別失敗はnotesへ）→ build-prompt → generate → publish。`--no-publish` で `/tmp` 出力＋標準出力表示。銘柄はargv（`btc`）。

- [ ] **Step 1: keyData要約のテストを書く**

Create `pipeline/run.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { summarizeKeyData } from './run';
import type { FetchBundle } from './types';

const bundle = {
  market: { price_usd: 63631, ath_change_pct: -49.53, btc_dominance: 56.39 },
  onchain: { mvrv_z: 0.344, sopr: 0.988 },
} as unknown as FetchBundle;

describe('summarizeKeyData', () => {
  it('produces a compact key-data string', () => {
    const s = summarizeKeyData(bundle);
    expect(s).toContain('$63,631');
    expect(s).toContain('56.39%');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run pipeline/run.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装**

Create `pipeline/run.ts`:
```ts
import { writeFileSync } from 'node:fs';
import type { FetchBundle, SourceNote } from './types';
import { btcConfig } from './config/btc';
import { fetchCoinGecko } from './fetch/coingecko';
import { fetchGlassnode } from './fetch/glassnode';
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
    safe('Glassnode', () => fetchGlassnode(cfg, notes)),
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

// 直接実行時のみ main を起動（テスト import 時は走らせない）
if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run pipeline/run.test.ts`
Expected: PASS。

- [ ] **Step 5: 全テスト実行**

Run: `npx vitest run pipeline`
Expected: 全PASS。

- [ ] **Step 6: Commit**

```bash
git add pipeline/run.ts pipeline/run.test.ts
git commit -m "feat(pipeline): run orchestrator with --no-publish dry run"
```

### Task 15: ライブ・ドライラン検証（手動）

**Files:** （コード変更なし。鍵が要るのでローカル `.env` を使う）

- [ ] **Step 1: ローカルでドライラン**

Run:
```bash
set +x; source ./.env
OLLAMA_API_KEY="$OLLAMA_API_KEY" SANTIMENT_API_KEY="$SANTIMENT_API_KEY" \
COINALYZE_API_KEY="$COINALYZE_API_KEY" GLASSNODE_API_KEY="$GLASSNODE_API_KEY" \
npx tsx pipeline/run.ts btc --no-publish
```
Expected: `/tmp/btc-dryrun.md` に記事生成。notes に取得失敗ソースが（あれば）並ぶ。本文がrunbook §4構成・ベースライン言及・免責付きであること、`号`等の自己言及語が無いことを目視確認。

- [ ] **Step 2: 取得失敗ソースがあれば対処**

各fetchの実レスポンス形がfixtureと違っていた場合（特にPolymarket/Coinalyze）、対応する `fetch*` のアダプタとfixture・parseを実形に合わせて修正し、該当Taskのテストを再実行してPASSさせてからcommit。

- [ ] **Step 3: Next.jsビルドで記事が壊れないか確認（任意の実publishで）**

`--no-publish` を外して一度ローカルpublish → `npm run build` がエラーなく通ることを確認 → 生成物が不要なら `git restore` で戻す（mainを汚さない）。

### Task 16: GitHub Actions ワークフロー（Phase 1: PR出力）

**Files:**
- Create: `.github/workflows/publish-btc.yml`

最初は `workflow_dispatch`（手動）のみ有効。出力は**専用ブランチへpush**し、main には出さない（Phase 1検証）。cron行はコメントアウトで用意。

- [ ] **Step 1: ワークフローを作成**

Create `.github/workflows/publish-btc.yml`:
```yaml
name: publish-btc
on:
  workflow_dispatch: {}
  # Phase 2 で有効化:
  # schedule:
  #   - cron: '0 */6 * * *'

permissions:
  contents: write
  pull-requests: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - name: Generate article
        env:
          OLLAMA_API_KEY: ${{ secrets.OLLAMA_API_KEY }}
          SANTIMENT_API_KEY: ${{ secrets.SANTIMENT_API_KEY }}
          COINALYZE_API_KEY: ${{ secrets.COINALYZE_API_KEY }}
          GLASSNODE_API_KEY: ${{ secrets.GLASSNODE_API_KEY }}
          COINGECKO_API_KEY: ${{ secrets.COINGECKO_API_KEY }}
        run: npx tsx pipeline/run.ts btc
      - name: Commit to validation branch (Phase 1)
        run: |
          git config user.name "narrative-bot"
          git config user.email "bot@users.noreply.github.com"
          BRANCH="auto/btc-$(date -u +%Y%m%d-%H%M%S)"
          git checkout -b "$BRANCH"
          git add -A
          git commit -m "auto: 6h BTC分析（検証・Phase1）" || { echo "no changes"; exit 0; }
          git push origin "$BRANCH"
          echo "pushed $BRANCH"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish-btc.yml
git commit -m "ci(pipeline): add publish-btc workflow (Phase1 manual/PR output)"
```

- [ ] **Step 3: workflow を main に push して手動実行**

```bash
git push origin main
gh workflow run publish-btc.yml
gh run watch
```
Expected: 成功し `auto/btc-...` ブランチが生成される。ブランチ上の記事を確認。

- [ ] **Step 4: Claude版と品質比較（数サイクル）**

手動実行を数回行い、Claude版（既存ルーチン）の同時刻記事と比較。runbook §1/§4準拠・重複回避・取得失敗時の注記を確認。問題があれば該当Task（多くは build-prompt）を修正して再検証。

---

## Phase 2: カットオーバー（手動・検証OK後）

### Task 17: public化と cron 有効化、Claudeルーチン停止

- [ ] **Step 1: リポジトリをpublic化**（Settings → General → Change visibility）。Task 0bのスキャンがクリーンであること再確認。
- [ ] **Step 2: cron有効化＋main直publishへ切替**

`.github/workflows/publish-btc.yml` を編集:
- `schedule: - cron: '0 */6 * * *'` のコメントを外す。
- 「Commit to validation branch」ステップを main 直pushに置換:
```yaml
      - name: Commit & push to main (Phase 2)
        run: |
          git config user.name "narrative-bot"
          git config user.email "bot@users.noreply.github.com"
          git add -A
          git commit -m "publish: 6h分析 $(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M') (auto)" || { echo "no changes"; exit 0; }
          git pull --rebase origin main
          git push origin main
```
Commit:
```bash
git add .github/workflows/publish-btc.yml
git commit -m "ci(pipeline): enable cron + main publish (Phase2 cutover)"
git push origin main
```

- [ ] **Step 3: 既存Claudeリモートルーチンを停止**（二重公開防止）

RemoteTrigger（claude.ai）で `trig_0178FGpvyY3MSSKDLnczBwPQ` を `enabled:false` に更新、または claude.ai のルーチンUIから無効化。停止を確認。

- [ ] **Step 4: 次のcron発火を監視**

`gh run list --workflow=publish-btc.yml` で発火・成功を確認。`origin/main` に記事が乗りVercelがデプロイされ、サイトに反映されることを確認。INDEXのt=0が前進していること。

---

## 自己レビュー結果（spec照合）

- **§4 アーキテクチャ（config/fetch/build-prompt/generate/publish/run）** → Task 2–14 で全実装。✅
- **§5 単発・決定論（methodology+data+直近5本）** → Task 11 buildPrompt（GUARDRAILS＋fmtData＋recentBlock）。✅
- **§6 データフロー（cron→fetch→prompt→generate→publish→push）** → Task 14 run＋Task 16/17 workflow。✅
- **§7 シークレット** → Task 0c＋Task 16 env。Glassnode要否はTask 0a。✅
- **§8 エラーハンドリング（失敗ソース注記/中断せず・nemotron1リトライ/冪等）** → collect()のsafe＋notes（Task14）、generate retry（Task12）、publish既存スキップ（Task13）。✅
- **§9 テスト（fetch parse/build-promptスナップショット/ドライラン/ビルド）** → 各Taskのvitest＋Task15。✅
- **§10 段階（Phase0/1/2）** → Task 0/1–16/17。✅
- **§6ソース全部** → Task 4–9。✅
- **型整合** → `parse*` の戻り値が `types.ts` と一致。`fetch*(cfg, notes?)` シグネチャは run の `safe()` 呼び出しと一致。`buildPrompt(bundle, recent, cfg, asof)` は Task11テスト/Task14呼び出しと一致。✅

**未解決（実装時に確定）**: Polymarket/Coinalyze の実レスポンス形（Task 8/15 でアダプタ調整）、Glassnode無料枠メトリクス範囲（Task 0a）。いずれもfixture＋アダプタ方式で parse の純粋性を保ったまま吸収する設計。
