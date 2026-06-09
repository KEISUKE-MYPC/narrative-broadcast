# BTCナラティブ分析 運用Runbook

実データ付き6h分析を毎サイクル再現するための手順書。
前提スキル: `narrative-analysis`（方法論）／本書はその**データ取得の実務**。
最終更新: 2026-06-04

---

## 0. クイックスタート

次セッションで「6h分析やって」と言われたら、本書の **§2 → §3 → §4 → §5** の順で回す。
`claude --continue` で再開すると全MCPツール（coingecko/glassnode/santiment）が使える。

データソース一覧（接続済み）:

| 層 | ソース | アクセス | 盲点 |
|---|---|---|---|
| 言説・頻度 | Santiment MCP / GraphQL | `get_trending_words` 等 | B3 |
| 市場・セクター | CoinGecko MCP | `mcp__coingecko__execute` | — |
| 群衆の金 | Polymarket Gamma API | WebFetch（鍵不要） | B4 |
| オンチェーン実態 | Glassnode MCP | `fetch_metric`（公開30日） | B5 |
| ポジション混雑 | Coinalyze API | curl + `.env`鍵 | B5 |
| セクター資金 | DefiLlama API | WebFetch（鍵不要） | — |
| 一次CT | X | **未自動化（手動）** | B1 |
| 日本語 | CoinPost等 | **未自動化（手動）** | B2 |

鍵は `.env`（`COINALYZE_API_KEY` / `SANTIMENT_API_KEY`）。権限保護され直接Readは不可。
curlで使う時は `set +x; source ./.env` してから。**鍵の値は画面に出さない**。

---

## 1. 方法論ガードレール（スキル準拠・必読）

毎回これを守る。破るとレッドフラグ。

1. **スコアを結論にしない**：Fear&Greed、Santimentの`sentiment_balance`/`social_dominance`、各社の強気/弱気%は「色付け」まで。分析は「どう語られているか」の構造で行う。
2. **ベースライン必須**：「シフトした」と言う前に t=0 を述べる（基準: 2025-10 ATH $126,080）。
3. **反証検索**：支配ナラティブを否定するソースを能動的に探す。今日の教訓＝**推測を実データで殴る**（例: 「ショート混雑」と決めつけずCoinalyzeで実ポジ確認）。
4. **reflexivity確認**：価格↔ナラティブの共変・リード/ラグを必ず判定。共変時は予測信頼度を1段下げる。
5. **断定/価格予想/売買助言をしない**：認知の歪みの指摘に留める。末尾に免責。
6. **サイクル**：BTCは**6hが土台**（4hは構造分析に不向き。[[btc-broadcast-cadence]]）。

---

## 2. データ取得手順

### 2.1 市場・セクター（CoinGecko MCP）
`mcp__coingecko__execute` で以下を実行（intent明記）:
```js
async function run(client) {
  const btc = await client.coins.getID('bitcoin', { localization:false, tickers:false, market_data:true, community_data:false });
  const md = btc.market_data;
  const global = await client.global.get();
  const cats = await client.coins.categories.get({ order: 'market_cap_change_24h_desc' });
  return {
    price_usd: md.current_price.usd,
    chg_24h: md.price_change_percentage_24h,
    chg_7d: md.price_change_percentage_7d,
    chg_30d: md.price_change_percentage_30d,
    ath: md.ath.usd, ath_change_pct: md.ath_change_percentage.usd, ath_date: md.ath_date.usd,
    btc_dominance: global.data.market_cap_percentage.btc,
    total_mcap_chg_24h: global.data.market_cap_change_percentage_24h_usd,
    sectors_top: cats.slice(0,5).map(c=>({name:c.name,chg24h:c.market_cap_change_24h})),
  };
}
```
注: マイクロキャップのセクター騰落はノイズ多め。ドミナンスの方が信頼できる。

### 2.2 オンチェーン実態（Glassnode MCP）
公開アクセスは直近30日・日足。単一資産は`fetch_metric`、複数は`fetch_bulk_metrics`。
- MVRV Z-Score: `/v1/metrics/market/mvrv_z_score` （a=BTC, i=24h）
- SOPR: `/v1/metrics/indicators/sopr`
- 長期保有者供給: `/v1/metrics/supply/lth_sum`
- 価格: `/v1/metrics/market/price_usd_close`

### 2.3 群衆の金（Polymarket・WebFetch・鍵不要）
- 銘柄探索: `https://gamma-api.polymarket.com/public-search?q=bitcoin&limit_per_type=8`
- 年末オッズ: `https://polymarket.com/event/what-price-will-bitcoin-hit-before-2027`
読み: 下落側ターゲットの確率（例 $55k到達%）＝弱気の賭け集中度。6桁到達%が低い＝強気は「金が伴わない物語(cheap talk)」。

### 2.4 ポジション混雑（Coinalyze・curl・要鍵）
```bash
set +x; source ./.env
KEY="$COINALYZE_API_KEY"
SYM="BTCUSDT_PERP.A,BTCUSD_PERP.A,BTC-PERPETUAL.2,BTCUSDT_PERP.4,BTCUSDT_PERP.F"
# 現在ファンディング / 予測 / 建玉
curl -s "https://api.coinalyze.net/v1/funding-rate?api_key=${KEY}&symbols=${SYM}"
curl -s "https://api.coinalyze.net/v1/open-interest?api_key=${KEY}&symbols=${SYM}&convert_to_usd=true"
# ロングショート比（履歴の最新）: fields = t / r(ratio) / l(long%) / s(short%)
NOW=$(date +%s); curl -s "https://api.coinalyze.net/v1/long-short-ratio-history?api_key=${KEY}&symbols=BTCUSDT_PERP.A&interval=1hour&from=$((NOW-21600))&to=${NOW}"
# 建玉24h推移: open-interest-history （c=値）
```
注意点:
- funding `value` は生fraction（×100で%）。**取引所で符号がバラつく**（Binanceは小さめ＋、Deribit等は大きめ−）ので一venueで断定しない。BinanceがOI最大の基準venue。
- 日中足は古いデータを毎日削除→**長期比較は自前でスナップショット保存が必要**。

### 2.5 言説・頻度（Santiment）
MCPツール（次セッション以降）: `get_trending_words` / `alert_social_shift` / `get_social_volume`。
※ `get_sentiment_balance` / `get_social_dominance` はスコア系=結論にしない。
curlフォールバック（今すぐ・要鍵）:
```bash
set +x; source ./.env
curl -s https://api.santiment.net/graphql \
  -H "Authorization: Apikey ${SANTIMENT_API_KEY}" -H "Content-Type: application/json" \
  -d '{"query":"{ getTrendingWords(size:12, from:\"utc_now-2d\", to:\"utc_now\", interval:\"1d\") { datetime topWords { word score } } }"}'
```
読み: トレンド語を「弱気フレーム / 反転フレーム / KOL名 / 銘柄ノイズ」に仕分け。
語彙の創発（6ヶ月前に無かった語）と頻度の方向が軸の証拠になる。

### 2.6 セクター資金（DefiLlama・WebFetch/curl・鍵不要）
- **総供給（号またぎ比較の正準値）**: `https://stablecoins.llama.fi/stablecoincharts/all` → 最新の `totalCirculatingUSD.peggedUSD` を総供給とし、約7日前の同値から W/W 変化を出す。**毎号この系列を固定で使う**（`/stablecoins`の単純合算は対象数で揺れるので総供給には使わない）。
- 内訳（USDT/USDC等の色付け）: `https://stablecoins.llama.fi/stablecoins?includePrices=false`
読み: 総供給の**増減方向**＝クリプトへの資金流出入の代理（絶対額より方向を重視）。2026は「ステーブル拡大」が主要中層ナラティブ。

---

## 3. 指標の読み方 早見表

| 指標 | 弱気/割高 | 強気/割安 | 備考 |
|---|---|---|---|
| MVRV Z-Score | >6〜7（天井圏） | <1（価値ゾーン）、<0（底圏） | 認知と実態の乖離測定 |
| SOPR | >1（利益確定） | <1（損失投げ=キャピチュレーション） | 1.0回復は弱気一巡サイン |
| LTH供給 | 減（分散・利確） | 増（蓄積） | 週次の方向で見る |
| Funding | 大きく−（ショート混雑） | +（ロング居残り） | venue差大。Binance基準 |
| L/S比 | long%低（弱気傾斜） | long%高だが下落中＝ロング投げ | r/l/s |
| 建玉(OI) | 上昇＝レバ過熱 | 下落＝デレバレッジ/投げ | 価格と併読 |
| Polymarket下落到達% | 高＝弱気混雑 | — | 混雑剥落が転換触媒 |
| BTCドミナンス | — | 高＝資金がBTC滞留 | アルト逃避の有無 |

**乖離の検出が肝**：複数層が同方向で一致＝reflexive loop後期の混雑。
逆に層が食い違う（例: 物語弱気／実ポジ強気／オンチェーン割安）＝「投げ売り未完了」。

---

## 4. 記事フォーマット（プロジェクトCLAUDE.md準拠）

1. **実データ計器盤テーブル**（指標・実測値・ソース・読み）＝差別化の核
2. タイトル（支配ナラティブ1行。**物語そのものを書く**。「〜号」「今号」「速報」等の自己言及・体裁語で締めない／付けない）
3. 配信日時 / サイクル 6h / 強度 X/10（前回比）
4. 現在の支配的ナラティブ（2-3文）
5. ナラティブの構造分析（表層/中層/深層＋Reflexivity判定）
6. 競合・対抗ナラティブ（実データで再評価）
7. 注目すべき変化点（3つ、できれば監視する具体指標で）
8. トレーダー視点での示唆（認知の歪みの指摘。価格/売買助言は禁止）
9. 免責: 「本記事は情報提供を目的とし、投資助言ではありません」

文体: ですます調、1500-2500字（6h）、要点先出し、煽らない。

### 品質ルール（2026-06-09 追加）
- **① 用語の軽い補足（リテール向け）**: 専門語は**本文の初出時に括弧で一言**補足し、リテール読者が文脈を追えるようにする。例「SOPR（実現損益の符号。1.0割れ＝損失確定の売りが優勢）」「reflexivity（価格と物語が互いを増幅し合う反射ループ）」。ただし**詰め込みすぎない**・計器盤の「読み」列と重複させすぎない・既に補足済みの語は繰り返さない。
- **② 真空（凪）が続くときは切り口を変える**: BTC自前の物語が複数サイクル不在＝「真空／声なき」状態が続く場合、**毎回同じ枠組み・同じ書き出しを繰り返さない**。切り口を変える例: (a)何が真空を破る条件か (b)外部ニュース占拠の構造（誰の話題がBTC語彙を埋めているか） (c)どの層（言説/ポジション/オンチェーン）が先行/逆行しているか (d)真空が続く事実そのものの含意（「N日連続で真空」と明示し、その持続が何を意味するか）。同義の比喩（「声なき上昇」等）の使い回しを避け、号ごとに焦点をずらす。

---

## 5. 既知の盲点と運用

- **B1 一次CT**: X APIが高額で未自動化。手動でKOL/主要アカウントを確認 → 他媒体がやらない差別化領域。
- **B2 日本語**: 自動ツール弱い。CoinPost / あたらしい経済 / 日本語Xリストを手動巡回。
- **Coinalyze日中足**: 古いデータ毎日削除。長期ベースラインは自前スナップショット蓄積で対応（将来の自動化候補）。
- **Glassnode公開枠**: 30日・日足。長期は要APIキー（クレジット消費）。

---

## 7. リモート自動実行（routine用・自己完結手順）

**6時間ごと**（JST 03/09/15/21 頃）のリモートルーチン（Anthropicクラウド）が従う手順。リモートは**ローカルの`.env`/ローカルMCP/スキルにアクセスできない**が、鍵は**クラウド環境の環境変数**で渡せるため**6ソース全部使う**。

前提（Web UIで設定済みであること）:
- リポジトリ: `KEISUKE-MYPC/narrative-broadcast` をクローン
- コネクタ含む: CoinGecko / Glassnode（claude.ai接続済み）
- 環境変数: `COINALYZE_API_KEY` / `SANTIMENT_API_KEY`
- ネットワーク許可ドメイン（curl用）: `api.santiment.net` `api.coinalyze.net` `gamma-api.polymarket.com` `stablecoins.llama.fi`（CoinGecko/Glassnodeはコネクタ経由なので許可不要）

手順:
0. **【最重要】作業前に main を実体へ同期**: `git fetch origin && git checkout main && git reset --hard origin/main`。
   - **`origin/main` がこのリポジトリの正準・完全な状態**（公開済み記事・INDEX履歴・サイトコード一式が入っている）。
   - クラウドのローカル参照は古いことがある。もし「main に記事やINDEXやサイトコードが無い／runbookだけ」に見えても、それは**古い参照の見間違い**。**必ず fetch/reset で origin/main に合わせてから判断する**。
   - **絶対にやらないこと**: 「main が壊れている」と判断して `claude/...` 等のブランチに公開して終わること。公開先は常に `origin/main`。判断に迷ったら origin/main へ reset して続行する。
1. **ベースライン**: `articles/INDEX.md` 最新行 → t=0。
2. **データ取得（6ソース）**:
   - CoinGecko: **コネクタ**で 価格/24h/7d/30d/ATH/ドミナンス＋セクター騰落
   - Glassnode: **コネクタ**で `mvrv_z_score`/`sopr`/`lth_sum`（30日日足, a=BTC, i=24h）
   - Santiment: `curl -s https://api.santiment.net/graphql -H "Authorization: Apikey $SANTIMENT_API_KEY" -H "Content-Type: application/json" -d '{"query":"{ getTrendingWords(size:12, from:\"utc_now-2d\", to:\"utc_now\", interval:\"1d\"){ datetime topWords{ word score } } }"}'`
   - Coinalyze: `curl -s "https://api.coinalyze.net/v1/funding-rate?api_key=$COINALYZE_API_KEY&symbols=BTCUSDT_PERP.A,BTCUSD_PERP.A,BTC-PERPETUAL.2,BTCUSDT_PERP.4,BTCUSDT_PERP.F"` ＋ `open-interest`(convert_to_usd=true) ＋ `long-short-ratio-history`(fields r/l/s, from=now-21600)
   - Polymarket: `curl -s "https://gamma-api.polymarket.com/public-search?q=bitcoin&limit_per_type=8"`。**年末価格オッズは "what price will bitcoin hit in 2026"（slug: what-price-will-bitcoin-hit-before-2027）を使う**。ネタ/novelty市場（例: "$1M before GTA VI"）は強気指標に使わない
   - DefiLlama: **総供給は号またぎ正準値を使う**。`curl -s "https://stablecoins.llama.fi/stablecoincharts/all"` の最新 `totalCirculatingUSD.peggedUSD` を「総供給」とし、約7日前の同値から W/W 変化を算出（`/stablecoins`の合算は対象数で揺れるため総供給に使わない）。内訳（USDT/USDC等）が要る時のみ `https://stablecoins.llama.fi/stablecoins?includePrices=false`
3. **記事生成**: §1ガードレール厳守・§3早見表で解釈・`articles/_template.md`準拠の6h構成。冒頭注記: `> ⚠️ 自動生成｜6ソース`（main直接公開のため「下書き」表記は外す）
4. **保存**: `articles/YYYY/MM/YYYY-MM-DD-HHmm-6h-btc.md`（DRAFTサフィックスなし）
5. **INDEX追記**: 1行追加（状態=published）。
6. **コミット＆公開（必ず origin/main へ）**: `git add -A && git commit -m "publish: 6h分析 YYYY-MM-DD HH:MM (auto)"` → push前に前進分を取り込む `git pull --rebase origin main` → `git push origin main`。
   - **公開は origin/main 一択**。クラウドの自動ブランチ（`claude/...`）に置いたまま終わらない（＝サイトに反映されない）。
   - 直接pushが拒否される等で main に出せない場合のみ、ブランチへpush＋**PR作成して即マージ**し、main に必ず到達させる。
   - 次回実行がこのINDEXを t=0 に読むため baseline が前進する。
7. 断定/価格予想/売買助言は禁止、免責文必須、スコア系は使わない（§1）。

---

## 8. 用語メモ（ナラティブ頻出語・誤読防止）

トレンド語やナラティブで頻出する固有語の正確な意味。リモートは毎回ゼロ知識のため、推測でなくここを参照する。

- **STRC**：Strategy（旧MicroStrategy）の優先株。BTCを担保にした**信用商品**。Saylorが「世界最高の信用商品にする」と発言。「pristine collateral（BTCを通貨でもリスク資産でもなく担保基盤と捉える）」リフレームの中心。※「Strategic Bitcoin Reserve」とは別物。
- **saylor**：Michael Saylor／Strategy。「never sell」を掲げてきたが2026年5月に初のBTC売却（32 BTC, $2.5M）で象徴的後退。
- **arthur / hayes**：Arthur Hayes（BitMEX共同創業者、マクロ系KOL）。サイクル/マクロ論の発信源として頻出。
- **bottom / buy**：底値買い言説（demand reset系の対抗ナラティブ）。
- **digital gold ↔ risk asset**：BTCの自己定義をめぐる主軸（アイデンティティ軸）。
- **demand reset**：「下落は循環内の整理で、次の上昇前の需要リセット」とする強気フレーム。

---

## 9. 分野(カテゴリ)の運用（サイト連動）

サイトは分析を「分野」で区別する。**分野はファイル名の接尾辞で表す**（frontmatter不要）。

- **命名規約**: 記事ファイルは `YYYY-MM-DD-HHMM-<サイクル>-<分野>.md`。例: `2026-06-07-0905-6h-btc.md` の末尾 `-btc` が分野キー。
- **現在の分野**: `btc`（Bitcoin ナラティブ）のみ。
- **新しい分野を足す手順**:
  1. `lib/categories.ts` の `CATEGORIES` に1件追加（`slug` / `label` / `short` / `description` / `accent`）。
  2. その `slug` を接尾辞にした記事を置く（例 `…-eth.md`）。収集・チップ・パンくずは自動で対応する（`lib/articles.ts` はレジストリから接尾辞を組み立てるため改修不要）。
  3. ナビは分野が**2つ以上**になると自動表示される。
- **フェーズ2（2分野目で着手）**: 分野ページ `/c/<slug>`、トップの分野別レーン、`INDEX.md` の分野別分割、分野ごとのルーチン。
- 注意: `INDEX.md` と強度チャートは現状 **BTC専用**。他分野を足すときは分野別INDEXへ分割する（それまで他分野はトップ一覧/チャートに混ざらない）。
- **アイキャッチ／OGP**: 記事のアイキャッチ（カード・記事ヘッダー）とSNS用OG画像は分野＋INDEX行から**自動生成**（`components/Eyecatch.tsx` / `app/og/[...slug]/route.tsx`）。ルーチンの手順追加は不要。新分野は `categories.ts` に `symbol`・`ogAccent`（実hex色）も入れること。

---

## 6. 関連

- 方法論: `narrative-analysis` スキル
- ツール構成詳細・接続情報: memory `narrative-tool-stack`
- 配信サイクル方針: memory `btc-broadcast-cadence`
