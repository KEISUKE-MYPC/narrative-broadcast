# GitHub Actions × nemotron 自動公開パイプライン 設計仕様

最終更新: 2026-06-13
ステータス: 設計承認済み（実装プラン作成前）

## 1. ゴール

BTCナラティブ分析の6h自動公開を、**PC非依存・GitHub Actions（無料枠）・執筆はnemotron** の構成へ移行する。

- 実行ホストとスケジューラを GitHub のクラウドに置き、ローカルMac（在宅PC）への依存を排除する。
- 記事執筆は Ollama Cloud の `nemotron-3-ultra:cloud` に委譲する（Claudeをループから外す）。
- **汎用（config駆動）設計**にし、**今回はBTCのみ実装**。将来 SOL・他銘柄・他分野は config＋プロンプト雛形の追加で拡張できる継ぎ目を最初から作る（YAGNI：SOL本体は作らない）。

### 非ゴール（今回スコープ外）

- SOL や他銘柄・他分野の実データ取得・プロンプト実装（継ぎ目だけ用意し、実装は後続サイクル）。
- 既存サイト（Next.js）側のUI変更。
- 2パス生成・LLMによる自己批評・Claude QA などの品質ガード（採用しない。下記§5参照）。

## 2. 背景と確定事項

- リポジトリ: `github.com/KEISUKE-MYPC/narrative-broadcast`（現 private、Phase 2で public化予定）。
- サイト: Next.js + Vercel（`narrative-broadcast.com`、main pushで自動デプロイ）。
- 現行の自動公開: claude.ai のリモートルーチン `trig_0178FGpvyY3MSSKDLnczBwPQ`（cron `0 */6 * * *`、Opus、6ソース、main直push）。本移行で**停止**する。
- 記事配置: `articles/YYYY/MM/YYYY-MM-DD-HHmm-6h-btc.md`、一覧は `articles/INDEX.md`。
- 方法論: スキル `narrative-analysis` ＋ `runbook.md`（§1 ガードレール / §4 記事フォーマット・品質ルール / §8 用語メモ）。

### 調査で確定済みの技術的事実

- Ollama Cloud API: `https://ollama.com/api/chat`、`Authorization: Bearer $OLLAMA_API_KEY`。認証なしは401。APIキーは `https://ollama.com/settings/keys` で発行。
- nemotron は `think:true`/`think:false` を選択可能。**本パイプラインは think:true**（指示遵守・長さ制御・推測抑制が無効版より良好だったため）。
- public化の安全性: `.env` は `.gitignore` 済み（`.env` / `.env.*`）。git履歴に実鍵の混入は確認されず（一致は `.env.example` プレースホルダと `runbook.md` の鍵名参照のみ）。Phase 0で最終スキャンを行う。

## 3. 採用した設計判断（ブレスト結果）

| 論点 | 決定 |
|---|---|
| 生成方式 | **単発・決定論パイプライン**（fetch → nemotron 1コール → commit）。直近5本のタイトル/切り口をプロンプトに渡し重複回避 |
| 拡張設計 | **汎用化（config駆動）・実装はBTCのみ** |
| データ範囲 | **6ソース全部** REST移植（市場/オンチェーン/言説/ポジション/予測市場/ステーブル） |
| 切り替え | **PR検証 → カットオーバー**（数サイクルmain外で品質確認後に切替） |

## 4. アーキテクチャ（config駆動・BTC実装）

実装言語は **TypeScript**（リポジトリが既にTS/Next.js）。GitHub Actions 内で `tsx` 実行。

```
pipeline/
  config/
    btc.ts          銘柄config: coingecko id / glassnode asset / santiment slug /
                    coinalyze symbol / polymarket market slug / プロンプト雛形パス /
                    出力パスパターン / category / baseline(ATH等)
  fetch/
    coingecko.ts    価格・24h/7d/30d・ATH・ドミナンス・セクター騰落（鍵不要）
    glassnode.ts    MVRV Z-Score / SOPR / 長期保有者供給（30日日足）
    santiment.ts    getTrendingWords（SANTIMENT_API_KEY）
    coinalyze.ts    funding-rate / open-interest / long-short-ratio（COINALYZE_API_KEY）
    polymarket.ts   年末価格オッズ（gamma-api、鍵不要）
    defillama.ts    ステーブル総供給＋W/W（鍵不要）
  build-prompt.ts   方法論ルール(runbook §1/§4) + 取得データ + 直近5本の
                    タイトル/切り口(INDEX.md) を結合してnemotronプロンプトを生成
  generate.ts       ollama.com /api/chat (nemotron-3-ultra:cloud, think:true) 呼び出し
  publish.ts        articles/YYYY/MM/…md 書き出し ＋ INDEX.md 追記
  run.ts            エントリ: config読込 → 全fetch(並列・失敗許容) → build-prompt →
                    generate → publish。引数で銘柄選択（例: tsx pipeline/run.ts btc）
```

### ユニットの責務と境界

- **fetch/\*** : 各ソース1モジュール。入力＝config、出力＝型付きデータ。外部RESTの差異をここに閉じ込める。単体でテスト可能。
- **build-prompt** : データ→プロンプト文字列の純関数。LLMやネットワークに非依存＝スナップショットテスト可能。
- **generate** : ollama呼び出しのみ。プロンプト入力→本文出力。
- **publish** : ファイルシステム＋INDEX操作のみ。`lib/index-parser` 等の既存資産を可能な範囲で再利用。
- **run** : 上記を束ねるオーケストレータ。失敗許容・注記収集はここで制御。

将来の銘柄追加 = `config/<asset>.ts` ＋ プロンプト雛形を足し、`run.ts <asset>` で回す。fetchモジュールは銘柄横断で再利用（configのidだけ差し替え）。

## 5. 生成方式の詳細（単発・決定論）

- データ取得は決定論的スクリプト、執筆のみ nemotron 1コール。
- プロンプトに以下を必ず含める:
  - runbook §1 方法論ガードレール（スコアを結論にしない / ベースライン必須 / 断定・価格予想・売買助言の禁止 / reflexivity判定 / 層の食い違い注目）。
  - runbook §4 記事フォーマット・品質ルール（①専門語の軽い補足 ②真空継続時は切り口をずらす ③タイトルに自己言及接尾辞を付けない）。
  - 取得済み6ソースの実データ（数値）。
  - **直近5本のタイトル＋切り口**（INDEX.md から抽出）→ 重複回避の材料。
- 2パス・自己批評・Claude QA は**採用しない**（複雑さ・コスト増に対して、Phase 1のPR検証で品質を担保できるため）。

## 6. データフロー

```
GitHub Actions cron (0 */6 * * *, ubuntu-latest, タイムゾーンはJST換算で命名)
 → actions/checkout
 → actions/setup-node
 → npm ci
 → tsx pipeline/run.ts btc
     ├ 6ソース fetch（env secrets, 並列, 個別失敗許容）
     ├ build-prompt（methodology + data + 直近5本）
     ├ generate（curl相当: ollama.com /api/chat, nemotron, think:true）
     └ publish（articles/YYYY/MM/…md + INDEX.md 追記）
 → git add/commit
 → [Phase1] PR or ブランチへ push（main に出さない）
   [Phase2] main へ push → Vercel 自動デプロイ
```

ランナーは **Linux（ubuntu-latest, 課金1倍）**。nemotron推論はOllama Cloud側で走るためランナー時間は軽い（1回 約2〜4分想定、月120回で 240〜480分 ≪ 無料枠2,000分）。

## 7. シークレット管理

GitHub Actions Secrets に登録:

- `OLLAMA_API_KEY`（新規発行）
- `SANTIMENT_API_KEY`
- `COINALYZE_API_KEY`
- `GLASSNODE_API_KEY`（**要確認**: 現状はMCPコネクタ経由のため、REST直叩きに鍵が必要か planning で確定。必要なら発行、不可なら公開エンドポイント等の代替を検討）

CoinGecko / Polymarket / DefiLlama は鍵不要。public repo でも GitHub Secrets は露出しない（cron on main のため fork PR からのアクセス経路もなし）。

## 8. エラーハンドリング（現行runbookの挙動を踏襲）

- 各 fetch を個別 try/catch。失敗ソースは「注記配列」に積み、記事冒頭の注記（例:「> ⚠️ 取得失敗: Coinalyze」）に明記して**中断せず続行**。
- nemotron 呼び出し失敗 → 1回リトライ → なお失敗なら **publish せず** プロセスを異常終了（exit≠0）。壊れた記事を公開しない。Action は failed として可視化。
- 冪等性: ファイル名に JST タイムスタンプ。publish前に INDEX.md で同枠重複をチェックし、既存ならスキップ。

## 9. テスト戦略

- **fetch/\***: 各モジュールを fixture（記録済みレスポンス）またはライブ smoke で検証。
- **build-prompt**: 入力データ固定のスナップショットテスト（方法論ルール・直近5本・データが漏れなく含まれること）。
- **ドライラン**: `run.ts --no-publish` で `/tmp` 出力＋標準出力に表示。Phase 1 のPR検証で使用。
- **生成物検証**: Next.js ビルドが通ること（記事mdがSSGで正常レンダリング）。

## 10. 段階計画とカットオーバー

- **Phase 0 — 事前準備**
  - git履歴の徹底 secret スキャン（実鍵が無いことを最終確認）。
  - Ollama APIキー発行、GH Secrets 登録（4種）。
  - Glassnode REST 認証要件の確定。
- **Phase 1 — 構築と検証（main非公開）**
  - pipeline 実装 ＋ workflow（`workflow_dispatch` 手動 ＋ 出力は PR/ブランチ＝**mainに出さない**）。
  - 数サイクル手動実行し、Claude版と品質比較。`runbook.md` §1/§4 準拠を確認。
- **Phase 2 — カットオーバー**
  - repo を public 化 → cron 有効化。
  - Claude リモートルーチン `trig_0178FGpvyY3MSSKDLnczBwPQ` を**停止**（二重公開防止）。
- **将来 — 拡張**
  - SOL 等: `config/<asset>.ts` ＋ プロンプト雛形を追加。

## 11. 未解決の依存（planning で確定）

- **Glassnode REST 認証**: 鍵要否・無料枠で取得可能なメトリクス範囲。鍵が要る場合は発行、不可なら公開30日エンドポイント等の代替。
- **runbook §7 のcurl手順の TS 化**: 既存のcurlコマンド群を fetch モジュールに正確に移植（パラメータ・認証ヘッダ・レスポンス整形）。
- **INDEX.md パーサ再利用**: `lib/index-parser.ts` を pipeline から流用できるか（依存の切り出し）。
