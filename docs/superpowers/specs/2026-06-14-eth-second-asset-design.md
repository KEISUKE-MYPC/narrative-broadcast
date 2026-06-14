# ETH をパイロットとして第2銘柄追加 — 設計書

作成日: 2026-06-14

## 背景・課題
配信サイトは BTC のみ。分野(カテゴリ)基盤はサイト側で複数分野対応済みだが、パイプラインの
オンチェーン取得が BTC 専用ハードコードで他銘柄を追加できない。

データ源調査(2026-06-14):
- Coin Metrics Community API(無料・キー不要・ヘッドレス・約1日遅延): ETH=MVRV(CapMVRVCur)+活動アドレス(AdrActCnt)+取引所フロー(FlowIn/OutExUSD)(実データ確認済)。XRP=MVRV+活動アドレス。SOL=無料枠ほぼ不可。
- DefiLlama(無料・キー不要・統合済): ETH/SOL のチェーン手数料・DEX出来高(SOL用・次フェーズ)。

ETH をパイロットとして end-to-end 追加し、将来追加が config だけで済むようオンチェーン取得を汎用化する。

## ゴール
- ETH の6h分析を BTC 同等の3層(言説/ポジション/オンチェーン)で自動生成・公開。
- オンチェーン取得を銘柄汎用化し XRP/SOL を config 中心で追加可能に。

決定(2026-06-14): ETHパイロット→横展開 / 分野ページ /c/ は今回作らない / オンチェーンはラベル付き汎用形にしBTC挙動不変。

## ① データ層(中核)
### a. オンチェーン取得の汎用化
- types.ts の OnchainData を汎用化:
  `export type OnchainMetric = { label: string; value: number|string|null };`
  `export type OnchainData = { asof: string|null; metrics: OnchainMetric[] };`
- fetchOnchain(bitcoindata) は MVRV-Z/SOPR を metrics:[{MVRV-Z},{SOPR}] 形で返す(取得ロジック不変)。
- 新規 pipeline/fetch/coinmetrics.ts: fetchCoinMetricsOnchain(cfg,notes)
  - community-api.coinmetrics.io/v4/timeseries/asset-metrics から cfg.coinmetricsAsset の最新値:
    MVRV=CapMVRVCur / 活動アドレス=AdrActCnt / 取引所ネットフロー=FlowInExUSD-FlowOutExUSD(片方欠損なら省略)
  - 返り値 metrics:[{MVRV},{活動アドレス},{取引所ネットフロー}], asof=最新time。失敗指標は notes記録+省略(graceful)。
- run.ts の onchain取得を config 駆動:
  `const onchainFetch = cfg.onchainSource==='coinmetrics' ? ()=>fetchCoinMetricsOnchain(cfg,notes) : ()=>fetchOnchain(notes);`
- build-prompt fmtData のオンチェーン行を汎用化:
  `- オンチェーン: ${o.metrics.map(m=>...).join(' / ')}（asof ${o.asof??'N/A'}）`
- run.ts summarizeKeyData のオンチェーン部分を汎用化(先頭メトリクス表示)。

### b. ETH config(pipeline/config/eth.ts 新規)
```ts
export const ethConfig: AssetConfig = {
  key:'eth', cycle:'6h', coingeckoId:'ethereum',
  onchainSource:'coinmetrics', coinmetricsAsset:'eth',
  santimentSize:12,
  coinalyzeSymbols:'ETHUSDT_PERP.A,ETHUSD_PERP.A,ETH-PERPETUAL.2,ETHUSDT_PERP.4,ETHUSDT_PERP.F', // 実装時検証
  polymarketSlug:'', oddsTargets:[],   // ETH年末市場無ければ空(oddsスキップ)
  baselineAth:0, baselineAthDate:'',   // 実装時 CoinGecko の ETH ATH を設定
  outputDir:'articles',
  promptIntro:'ETH（イーサリアム）の6hナラティブ分析。市場参加者がETHをどう語っているか、その語り口の変化を構造分析する。',
};
```
- run.ts CONFIGS に eth:ethConfig 追加。
- AssetConfig(types.ts) に onchainSource:'bitcoindata'|'coinmetrics' と coinmetricsAsset?:string 追加。BTC config に onchainSource:'bitcoindata' 明記。

### c. プロンプトのBTCハードコード修正
GUARDRAILS 内の `基準ATH $126,080（2025-10-06）` 直書きを cfg.baselineAth/baselineAthDate 利用へ。
baselineAth 未設定なら当該指示を省く。BTC は config値で従来どおりをテストで担保。

### odds 任意化
cfg.polymarketSlug が空なら Polymarket をスキップ(null返し・致命的notesにしない)。

## ② 生成
pipeline/run.ts eth で生成。欠落ソースは既存 safe()+notes で graceful スキップ。

## ③ 自動化
- .github/workflows/publish-btc.yml を asset パラメータ化:
  - workflow_dispatch.inputs.asset (required:false, default:'btc') 追加。
  - 生成ステップを `npx tsx pipeline/run.ts ${{ inputs.asset || 'btc' }}` に。
  - ファイル名据え置き(cron-job.org の dispatch URL が publish-btc.yml を指すため)。
  - concurrency は全銘柄共有のまま(同時刻発火は直列化し main push 競合防止)。
- cron-job.org に ETH ジョブ追加(ユーザー作業): 同URL、body {"ref":"main","inputs":{"asset":"eth"}}、時刻は BTC と数分ずらす。

## ④ サイト
lib/categories.ts の CATEGORIES に ETH 追加:
```ts
{ slug:'eth', label:'Ethereum ナラティブ', short:'ETH',
  description:'市場参加者の物語と認知を6時間ごとに構造分析',
  symbol:'Ξ', accent:'var(--accent)', ogAccent:'#8a92b2' },
```
categoryFromSlug が -eth 記事を ETH 判定→SiteNav 自動表示・トップ分野別チャート・アーカイブ表示が自動機能。
記事は …-6h-eth.md で出力(publish.ts が cfg.key を接尾辞に使う既存挙動)。

## ⑤ テスト
- pipeline/fetch/coinmetrics.test.ts: MVRV/活動/フロー差分の抽出・欠損時省略。
- OnchainData 汎用化に伴う fmtData(build-prompt.test)・summarizeKeyData(run.test) の表示更新。
- BTC が従来どおり(MVRV-Z/SOPR・baseline 126080)を既存テストで担保。

## 検証方法
1. npm test 全パス、npx tsc --noEmit clean、npm run build 成功。
2. npx tsx pipeline/run.ts eth --no-publish で ETH 実データ取得→3層揃った記事生成を確認。
3. 本番1本(asset=eth)で …-6h-eth.md 公開・サイトに ETH 分野/SiteNav 出現を確認。
4. BTC の自動公開が従来どおり継続(回帰なし)。

## スコープ外(次フェーズ)
SOL追加(DefiLlama活動オンチェーン)・XRP追加(CoinMetrics)、分野ページ /c/、Artemis昇格、未使用フィールド整理。
