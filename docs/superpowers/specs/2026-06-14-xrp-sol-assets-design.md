# XRP・SOL を第3・第4銘柄として追加 — 設計書

作成日: 2026-06-14

## 背景・ゴール

BTC・ETH に続き、XRP と SOL をナラティブ分析の対象銘柄として追加する。
ETH 追加で確立した config 駆動の多銘柄アーキテクチャ（`onchainSource` ディスクリミネータ＋
汎用 `OnchainData`＋config注入プロンプト）を踏襲し、コアパイプラインのロジックは極力変えない。

非ゴール:
- 記事生成モデル・publish/Vercel デプロイの仕組みの変更
- プロンプト方法論（GUARDRAILS）の変更

## データ可用性（2026-06-14 実API検証済み）

| レイヤー | XRP | SOL |
|---|---|---|
| 価格/ATH (CoinGecko) | ✅ ATH $3.65 (2025-07-18) | ✅ ATH $293.31 (2025-01-19) |
| オンチェーン (CoinMetrics community) | ✅ MVRV 0.785・活動アドレス 31,184（フローは非対応） | ❌ MVRVすら forbidden |
| オンチェーン代替 (DefiLlama) | — | ✅ Solana: TVL $4.77B・DEX出来高 $1.0B(24h)・手数料 $4.8M(24h) |
| トレンド語 (Santiment) | ✅ 銘柄非依存 | ✅ 銘柄非依存 |
| Coinalyze perp | ⚠️ シンボル要検証（ローカル鍵なし→CI/本番ドライランで確認） | ⚠️ 同左 |

**結論**:
- XRP は ETH と同一経路（`onchainSource: 'coinmetrics'`）で追加可能。
- SOL は CoinMetrics 無料枠が一切非対応のため、新オンチェーン源 `defillama-chain`
  （Solana のチェーン活動＝TVL/DEX出来高/手数料）を導入して3層を成立させる。

## アーキテクチャ

### 新オンチェーン源 `defillama-chain`（SOL 用・新規）

`onchainSource` ディスクリミネータに3つ目の値 `'defillama-chain'` を追加する。
既存の `'bitcoindata'`（BTC）/`'coinmetrics'`（ETH/XRP）と同列。

- `types.ts`:
  - `AssetConfig.onchainSource` を `'bitcoindata' | 'coinmetrics' | 'defillama-chain'` に拡張。
  - `AssetConfig` に `defillamaChain?: string` を追加（TVLエンドポイント用のチェーン名、例 `'Solana'`）。
- `pipeline/fetch/defillama-chain.ts`（新規）:
  - `fetchDefiLlamaChain(cfg, notes): Promise<OnchainData>`。
  - 取得（すべて無料・鍵不要）:
    - TVL: `GET https://api.llama.fi/v2/historicalChainTvl/{cfg.defillamaChain}` → 配列末尾 `.tvl`
    - DEX出来高: `GET https://api.llama.fi/overview/dexs/{slug}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true` → `.total24h`
    - 手数料: `GET https://api.llama.fi/overview/fees/{slug}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true` → `.total24h`
    - `slug = cfg.defillamaChain.toLowerCase()`（'Solana' → 'solana'）
  - 返り値 `OnchainData`（汎用 label-value）:
    - `{ label: 'チェーンTVL', value: '$4.77B' }`
    - `{ label: 'DEX出来高(24h)', value: '$1.0B' }`
    - `{ label: '手数料(24h)', value: '$4.8M' }`
    - `asof` = 取得日（`YYYY-MM-DD`）。
  - 各メトリクスは個別 try/catch で graceful。取得できたものだけ `metrics` に積む。失敗は `notes` に記録。
  - 金額整形: $1e9 以上は `$X.XXB`、$1e6 以上は `$X.XM`（端数は既存の整形方針に合わせる）。
- `run.ts` の `collect()` の onchain 分岐に3つ目のケースを追加:
  ```ts
  cfg.onchainSource === 'coinmetrics'      ? fetchCoinMetricsOnchain(cfg, notes)
  : cfg.onchainSource === 'defillama-chain' ? fetchDefiLlamaChain(cfg, notes)
  : fetchOnchain(notes)
  ```

### config 追加

`pipeline/config/xrp.ts`:
- `key:'xrp'`, `coingeckoId:'ripple'`, `glassnodeAsset:'XRP'`
- `onchainSource:'coinmetrics'`, `coinmetricsAsset:'xrp'`
- `coinalyzeSymbols`: `'XRPUSDT_PERP.A,XRPUSD_PERP.A,XRP-PERPETUAL.2,XRPUSDT_PERP.4,XRPUSDT_PERP.F'`（BTC/ETHのパターン踏襲・CIで検証）
- `polymarketSlug:''`, `oddsTargets:[]`（年末市場が確実でないため既定スキップ）
- `baselineAth:3.65`, `baselineAthDate:'2025-07-18'`
- `santimentSize:12`, `outputDir:'articles'`, `promptIntro`: XRP用文

`pipeline/config/sol.ts`:
- `key:'sol'`, `coingeckoId:'solana'`, `glassnodeAsset:'SOL'`
- `onchainSource:'defillama-chain'`, `defillamaChain:'Solana'`
- `coinalyzeSymbols`: `'SOLUSDT_PERP.A,SOLUSD_PERP.A,SOL-PERPETUAL.2,SOLUSDT_PERP.4,SOLUSDT_PERP.F'`（CIで検証）
- `polymarketSlug:''`, `oddsTargets:[]`
- `baselineAth:293.31`, `baselineAthDate:'2025-01-19'`
- `santimentSize:12`, `outputDir:'articles'`, `promptIntro`: SOL用文

`run.ts` の `CONFIGS` に `xrp: xrpConfig`, `sol: solConfig` を登録（import追加）。

### サイト側

- `lib/categories.ts` に2件追加:
  - XRP: `slug:'xrp'`, `label:'XRP（リップル）ナラティブ'`, `short:'XRP'`, `symbol`（フォールバック用）, `accent:'var(--accent)'`, `ogAccent`（XRPアイコン基調色）
  - SOL: `slug:'sol'`, `label:'Solana ナラティブ'`, `short:'SOL'`, `symbol`, `accent:'var(--accent)'`, `ogAccent`（SOLアイコン基調色）
  - `ogAccent` は同梱アイコンの基調色から決める（XRP=アイコン円色、SOL=パープル/グリーン系）。
- `public/icons/xrp.svg`・`sol.svg`: cryptocurrency-icons の color 変種を同梱（既存 `/icons/<slug>.svg` 規約）。
- 既存の SiteNav・/c/[slug]・/og/[...slug]・アイキャッチは categories と slug規約で自動対応（変更不要）。

### 自動化（コード）

`.github/workflows/publish-btc.yml` は `workflow_dispatch.inputs.asset`（既定btc）で既にパラメータ化済みのため変更不要。
input の `description` 文言を `btc/eth/xrp/sol` に更新するのは任意（機能影響なし）。

### 自動化（ユーザー作業・コード外）

cron-job.org に XRP・SOL のジョブを追加（既存BTC/ETHジョブを複製）:
- body: `{"ref":"main","inputs":{"asset":"xrp"}}` / `{"ref":"main","inputs":{"asset":"sol"}}`
- schedule（BTC `0`・ETH `15` と衝突回避）: XRP `30 */6 * * *`、SOL `45 */6 * * *`（Asia/Tokyo）
- PAT は既存と同一を再利用。

## テスト

- `pipeline/fetch/defillama-chain.test.ts`（新規）＋ `__fixtures__/defillama_chain_*.json`: TVL/DEX/手数料のparse、欠損時の省略、空応答。
- `pipeline/fetch/coinmetrics.test.ts`: XRP（フロー欠落＝MVRV+活動アドレスのみ）のケースを `__fixtures__/coinmetrics_xrp.json` で追加。
- `pipeline/config/xrp.test.ts`・`sol.test.ts`（または既存 config テストに追記）: 各 config が正しい必須値を持つこと。
- 既存テスト（BTC/ETH）が全て回帰なく PASS すること。
- `npx tsc --noEmit` クリーン、`npm run build` 成功。

## 検証方法

1. `npx vitest run`（全テスト PASS）・`npx tsc --noEmit`・`npm run build`。
2. ドライラン: `npx tsx pipeline/run.ts xrp --no-publish` / `... sol --no-publish`
   - XRP: 市場＋オンチェーン(MVRV/活動アドレス)＋trends＋ポジションが揃う。
   - SOL: 市場＋オンチェーン(TVL/DEX/手数料)＋trends＋ポジションが揃う。
   - Coinalyze の funding/OI/L-S が実値で返るか notes で確認（鍵はCI/本番環境）。
3. 本番1本ずつ workflow_dispatch（asset=xrp / sol）→ `articles/.../-xrp.md`・`-sol.md` が main push・HTTP200 配信。
4. サイト: `/c/xrp`・`/c/sol` が200、SiteNav に XRP/SOL、アイキャッチ・OG に公式アイコン。
5. BTC/ETH の自動公開が次サイクルも回帰なく継続。

## リスクと割り切り

- **Coinalyze シンボル**: ローカル鍵なしで未検証。標準パターンで設定しCI/本番ドライランで確認。
  graceful なため一部シンボルが無効でも記事生成は継続（funding/OI/L-S が空になるだけ）。
- **SOL のオンチェーン意味の違い**: BTC/ETH/XRP は評価系（MVRV）、SOL は活動系（TVL/DEX/手数料）。
  指標の性質が異なる点はプロンプト/記事の文脈で自然に扱われる（汎用 label-value のため破綻はしない）。
- **DefiLlama 依存増**: ステーブル供給に加えチェーン活動でも DefiLlama を使う。無料・鍵不要で許容。
