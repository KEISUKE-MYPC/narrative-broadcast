# タクソノミー2階層化（ドメイン→トピック）— 設計

- **作成日**: 2026-06-21
- **対象**: narrative-broadcast（クリプト・ナラティブ観測メディア）
- **種別**: 既存システムの改修（URL/ルーティングのタクソノミー刷新）
- **背景方針**: [[multidomain-expansion]] の案X（タクソノミー刷新を先行）。クリプト外（RWA→将来AI/株）拡張の土台として、まず既存クリプトを2階層URLへ純リファクタする。

## ゴール

サイトを「ドメイン → トピック」の2階層タクソノミーに作り替え、URLを `/{domain}/{topic}/…` に移行する。これにより将来のドメイン追加（RWA/AI/株）が**ドメイン登録1件＋トピック登録**で済む構造にし、トピッククラスタのSEOを確立する。本リファクタの対象は**既存クリプトのみ**。

### 確定事項

| 論点 | 決定 |
|---|---|
| スコープ | 既存クリプトの純リファクタ＋301リダイレクト。新規コンテンツ（RWA記事）は作らない |
| URL移行範囲 | フル移行（記事URLも `/articles/…` → `/{domain}/{topic}/{stamp}` に移す） |
| 記事URLの形 | クリーン形 `/{domain}/{topic}/{timestamp}`（日付ディレクトリ・接尾辞は省略）例 `/crypto/btc/2026-06-20-1258` |
| ファイル保存 | **現状維持**（`articles/{YYYY}/{MM}/{stamp}-{cycle}-{topic}.md`）。URL/ルーティング層のみ付け替え |
| 週次の置き場 | `/crypto/weekly`（crypto ドメインの1トピック） |
| 登録ドメイン | `crypto` のみ。`rwa` は中身ができたら後から登録（`/rwa` ハブは今は作らない） |
| リダイレクト | 新規 `middleware.ts`（接尾辞→ドメイン導出のロジックが要るため）。すべて301 |
| ナビ | ドメインが1つの間はトピックタブ（BTC/ETH/XRP/SOL/週次）を新URLに向けるのみ。ドメイン束ねナビは2つ目のドメイン到来時に導入 |

## 非ゴール（YAGNI）

- RWA等の新ドメインの中身・トピック・データ取得。
- パイプライン `AssetConfig` の一般化、計器盤（定量データ）の任意化。
- ナビのドメイン束ね表示（[Crypto ▾][RWA ▾]）。
- ファイル群の物理再編（`articles/crypto/btc/…` への移動）。

## アプローチ

### 1. データモデル

`lib/categories.ts` 拡張 ＋ 新規 `lib/taxonomy.ts`：

- **`DOMAINS` レジストリ**（`lib/taxonomy.ts`）：現状 `[{ slug: 'crypto', label: 'Crypto', order: 1 }]` の1件のみ。
- **`Category`（＝topic）に `domain: string` を追加**（`lib/categories.ts`）。btc/eth/xrp/sol/weekly は全て `domain: 'crypto'`。
- **ヘルパ**（`lib/taxonomy.ts`）：
  - `getDomain(slug): Domain | undefined`
  - `domainOf(topicSlug): string`（topic → 所属ドメインslug。未知はデフォルト `crypto`）
  - `topicsInDomain(domainSlug): Category[]`（order順）
  - `DOMAINS: Domain[]`

### 2. URL生成の集約（新規 `lib/urls.ts`）

URL構築の単一の真実。全リンク生成箇所をこれ経由にする。

- `articleUrl(slug: string): string` — 記事slug `2026/06/2026-06-20-1258-6h-btc` を解析し `/{domain}/{topic}/{stamp}` を返す。topic は接尾辞、domain は `domainOf(topic)`、stamp は `YYYY-MM-DD-HHMM`。
- `topicHubUrl(topicSlug: string, page?: number): string` — `page` 無し/1 は `/{domain}/{topic}`、2以上は `/{domain}/{topic}/page/{n}`。
- `domainHubUrl(domainSlug: string): string` — `/{domain}`。

差し替え対象（現状のハードコードを `lib/urls.ts` 経由へ）：
- `app/sitemap.ts`（新URL群を出力、旧 `/articles/…`・`/c/…` は廃止）
- 記事ページの canonical
- `components/ArticleList.tsx`（記事リンク `/articles/${slug}` → `articleUrl(slug)`）
- `components/SiteNav.tsx`（`/c/${slug}` → `topicHubUrl(slug)`）
- `lib/seo.ts`（JSON-LD の記事URL・breadcrumb item）

### 3. ルーティング（App Router）

**新URL：**
- 記事：`/{domain}/{topic}/{timestamp}` 例 `/crypto/btc/2026-06-20-1258`
- トピックハブ：`/{domain}/{topic}` 例 `/crypto/btc`
- トピックページング：`/{domain}/{topic}/page/{n}`（`/2` だと記事 timestamp と曖昧になるため `/page/{n}` で明確化）
- ドメインハブ：`/{domain}` 例 `/crypto`（配下トピック一覧＋最新記事）

**新ルートファイル：**
- `app/[domain]/page.tsx` — ドメインハブ。`topicsInDomain` の一覧＋ドメイン内最新記事。`generateStaticParams` で全ドメイン。
- `app/[domain]/[topic]/page.tsx` — トピックハブ（旧 `/c/[slug]` 相当）。`generateStaticParams` で全 domain×topic。
- `app/[domain]/[topic]/page/[page]/page.tsx` — トピックページング（旧 `/c/[slug]/[page]` 相当）。
- `app/[domain]/[topic]/[stamp]/page.tsx` — 記事（旧 `/articles/[...slug]` 相当）。**ファイルは `articles/{YYYY}/{MM}/{stamp}-*-{topic}.md` を glob で解決**（cycle が URL に無くても topic+timestamp で一意）。
- 旧 `app/c/`・`app/articles/` ルートは**削除**（リダイレクトで代替）。
- 既存の静的ルート（`/archive`・`/og`・`/sitemap.xml` 等）は Next が動的 `[domain]` より優先解決するため共存可。`generateStaticParams` で domain を列挙するため `[domain]` は登録ドメイン（crypto）のみ生成。

**記事ファイル解決ヘルパ**（`lib/articles.ts` に追加）：
- `resolveArticleByStampTopic(stamp: string, topic: string): string | null` — `getArticleSlugs()` から `…/{stamp}-{cycle}-{topic}` 形に一致する slug を返す（無ければ null → 404）。

### 4. リダイレクト（新規 `middleware.ts`）

旧URLは接尾辞からドメインを導出するロジックが必要なため next.config 静的ルールでは不可。middleware で301：

- `/articles/{y}/{m}/{stamp}-{cycle}-{topic}` → `/{domain}/{topic}/{stamp}`（純粋な文字列変換、ファイル参照不要。topic=接尾辞、domain=`domainOf(topic)`、stamp=先頭の `YYYY-MM-DD-HHMM`）
- `/c/{topic}` → `/{domain}/{topic}`
- `/c/{topic}/{n}` → `/{domain}/{topic}/page/{n}`
- それ以外（`/`・`/archive`・`/og`・新URL・静的アセット）は素通り。

実装方針：middleware の `matcher` を `['/articles/:path*', '/c/:path*']` に限定し、上記変換を行って `NextResponse.redirect(url, 301)`。既存 `next.config.mjs` の vercel.app→.com リダイレクトは維持（共存）。

### 5. ナビゲーション

`components/SiteNav.tsx`：当面はドメインが1つ（crypto）なので、現状のトピックタブ（BTC/ETH/XRP/SOL/週次）を **`topicHubUrl()` 経由の新URL**に向けるのみ。active 判定も新URL基準に更新。ドメイン束ねナビ（[Crypto ▾][RWA ▾]）は2つ目のドメイン到来時に別途。

### 6. ドメインハブの中身（`/crypto`）

- ドメイン名・説明
- 配下トピックへのリンク一覧（`topicsInDomain('crypto')`）
- ドメイン内の最新記事リスト（既存 `ArticleList` を流用、ドメインで絞り込み）

トピックハブ（`/crypto/btc`）は既存 `/c/[slug]` のページ内容をそのまま移植（チャート・記事一覧）。

## エラーハンドリング / エッジケース

- **未登録ドメイン/トピックへのアクセス**：`generateStaticParams` 外の `[domain]`/`[topic]` は `notFound()`（404）。
- **存在しない stamp**：`resolveArticleByStampTopic` が null → `notFound()`。
- **旧OG URL**：`/og/[...slug]` は記事slugキーの画像エンドポイント（公開ページではない）ため現状維持。記事ページ側は引き続き同エンドポイントを参照。
- **ページング範囲外**：既存の挙動（範囲外は404 or 最終ページ）を踏襲。
- **middleware の取りこぼし**：`matcher` を旧パスに限定するため新URL・静的アセットには干渉しない。

## テスト

- `lib/urls.ts`：`articleUrl`（btc/weekly 各形）・`topicHubUrl`（page有無）・`domainHubUrl` の単体テスト。
- `lib/taxonomy.ts`：`domainOf`・`topicsInDomain`・`getDomain` の単体テスト。
- `lib/articles.ts`：`resolveArticleByStampTopic`（一致・不一致）の単体テスト。
- middleware：旧→新マッピング（`/articles/…`・`/c/btc`・`/c/btc/2`）の単体テスト（変換関数を純関数として切り出してテスト）。
- `app/sitemap.ts`：新URLのみを出力し旧形を含まないこと。
- ビルド（全SSGルート生成）＋ `tsc --noEmit`。

## 影響範囲

| ファイル/領域 | 変更 |
|---|---|
| `lib/taxonomy.ts`（新規） | DOMAINS レジストリ＋ドメインヘルパ |
| `lib/categories.ts` | Category に `domain` 追加（btc/eth/xrp/sol/weekly=crypto） |
| `lib/urls.ts`（新規） | URL生成の単一の真実（article/topicHub/domainHub） |
| `lib/articles.ts` | `resolveArticleByStampTopic` 追加 |
| `app/[domain]/page.tsx`（新規） | ドメインハブ |
| `app/[domain]/[topic]/page.tsx`（新規） | トピックハブ（旧 /c/[slug]） |
| `app/[domain]/[topic]/page/[page]/page.tsx`（新規） | トピックページング |
| `app/[domain]/[topic]/[stamp]/page.tsx`（新規） | 記事（旧 /articles/[...slug]） |
| `app/c/`・`app/articles/`（削除） | 旧ルート撤去（middlewareで301代替） |
| `middleware.ts`（新規） | 旧→新URLの301 |
| `app/sitemap.ts` | 新URL群を出力 |
| `components/ArticleList.tsx`・`SiteNav.tsx` | リンクを `lib/urls.ts` 経由へ |
| `lib/seo.ts` | JSON-LD URL・breadcrumb を新URLへ |
| 各 `*.test.ts`（新規） | 上記テスト |
