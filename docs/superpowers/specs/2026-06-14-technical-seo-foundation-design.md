# 技術SEOの土台を固める — 設計書

作成日: 2026-06-14

## 背景・課題

narrative-broadcast は6時間ごとに自動生成されるBTCナラティブ分析記事を配信している。
サイトレベルのSEO土台（`metadataBase`・title・description・`robots.ts`・動的`sitemap.ts`・
分野別OG画像・Twitterカード・`lang="ja"`・パンくずUI）は既にあるが、以下が未整備：

- **構造化データ(JSON-LD)が皆無**（Article / BreadcrumbList / WebSite / Organization）
- **記事ごとの meta description が無い**（titleのみ）
- **canonical URL・公開/更新日時メタが無い**（ニュース性コンテンツで鮮度シグナルが弱い）
- **`.com` と `.vercel.app` が両方インデックス可能**＝重複コンテンツの懸念

## ゴール

既存の自動生成記事を、検索エンジンに**正しく・豊かに**伝える技術土台を整備する。
パイプライン本体（`pipeline/`）は変更せず、サイト側（`app/`・`lib/`・`components/`）のコードで完結する。

決定事項（2026-06-14）:
- 記事の構造化データタイプは **Article**（NewsArticleは要件が厳しく自動生成コンテンツに不適のため不採用）。
- 重複ドメインは **`.vercel.app` → `.com` へ301リダイレクト**（評価シグナルを.comに集約）。
- description は**本文から自動抽出**（パイプライン改修なし・既存記事に遡及適用）。

## 非ゴール（今回やらない）

キーワード戦略・記事ごとの個別OG画像・RSS配信・Google Search Console連携・
Core Web Vitals最適化。これらは別タスク。

## コンポーネント構成

### ① description自動抽出 — `lib/excerpt.ts`（新規）

`getArticleDescription(slug: string): string`
- 記事raw（`getArticleBySlug`経由）から最初の「実段落」を取得する。
- スキップ対象：空行、H1(`# `)、H2/H3など見出し(`#`)、引用(`> `)、HTMLコメント。
- 最初に現れた通常テキスト段落を採用。
- Markdown記法を除去：太字`**`、インラインコード`` ` ``、リンク`[text](url)`→text、強調`*`。
- 連続空白を1つに畳み、前後をtrim。
- 約150字でtruncate（語の途中でも可、末尾に `…` を付与。150字未満ならそのまま）。
- 段落が見つからない場合は固定フォールバック（サイトdescription）を返す。

### ② SEOヘルパー — `lib/seo.ts`（新規）

定数：
- `SITE_URL = 'https://narrative-broadcast.com'`
- `SITE_NAME = 'Narrative Broadcast'`
- `SITE_DESCRIPTION = '市場参加者の物語と認知を構造分析するナラティブ観測メディア'`

関数：
- `publishedISO(slug: string): string`
  スラッグ末尾の `YYYY-MM-DD-HHMM` を抽出し、JST(+09:00)のISO8601へ変換。
  例：`2026/06/2026-06-14-0047-6h-btc` → `2026-06-14T00:47:00+09:00`。
  抽出失敗時は日付のみ（`...-HHMM`が無い場合）→ `YYYY-MM-DDT00:00:00+09:00`。
- `absoluteUrl(path: string): string` … `SITE_URL` + path。
- `websiteJsonLd(): object` … `@type: WebSite`（name, url, description, inLanguage: 'ja'）。
- `organizationJsonLd(): object` … `@type: Organization`（name, url, logo=絶対URLのicon）。publisher兼author用。
- `articleJsonLd(args): object` … `@type: Article`。
  フィールド：headline(title), description, datePublished, dateModified(=datePublished),
  image(絶対URLの分野別OG), author(Organization), publisher(Organization),
  inLanguage: 'ja', mainEntityOfPage(記事の絶対URL)。
- `breadcrumbJsonLd(args): object` … `@type: BreadcrumbList`。
  itemListElement：1.ホーム(SITE_URL) → 2.アーカイブ(`/archive`) → 3.分野名(記事URL)。

### ③ JSON-LDレンダラ — `components/JsonLd.tsx`（新規）

サーバコンポーネント。`data: object | object[]` を受け取り
`<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(data)}} />`
を出力する。XSS対策として `<` を `<` にエスケープする。

### ④ 記事ページ — `app/articles/[...slug]/page.tsx`（変更）

`generateMetadata` に追加：
- `description`（`getArticleDescription`）
- `alternates: { canonical: '/articles/' + slugPath }`
- `openGraph`: `type: 'article'`、`description`、`publishedTime: publishedISO(slugPath)`、`url`
- `twitter`: `description`

ページ本体に追加：
- `<JsonLd data={[articleJsonLd(...), breadcrumbJsonLd(...)]} />` をレンダリング。

### ⑤ ルートレイアウト — `app/layout.tsx`（変更）

`<body>` 内に `<JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />` を1回出力（サイト全体）。

### ⑥ home / archive のcanonical — `app/page.tsx`・`app/archive/page.tsx`・`app/archive/[page]/page.tsx`（変更）

各ページに `export const metadata`（または`generateMetadata`）で
`alternates.canonical` と簡単な `description` を付与。
- home: canonical `/`
- archive: canonical `/archive`
- archive/[page]: canonical `/archive/{page}`

### ⑦ ドメイン重複解消 — `next.config.mjs`（変更）

`redirects()` を追加：
```js
async redirects() {
  return [{
    source: '/:path*',
    has: [{ type: 'host', value: 'narrative-broadcast.vercel.app' }],
    destination: 'https://narrative-broadcast.com/:path*',
    permanent: true,
  }];
}
```

## エラー処理

- description抽出で段落が見つからない／rawが空 → `SITE_DESCRIPTION` をフォールバック。
- `publishedISO` で日時パターン不一致 → 日付のみ（時刻00:00 JST）にフォールバック。例外は投げない。
- JSON-LDは静的生成時に組み立てるため実行時失敗のリスクは低い。

## テスト

既存テスト基盤（`*.test.ts`）に合わせて追加：
- `lib/excerpt`：見出し/引用スキップ・Markdown除去・150字truncate・フォールバック。
- `lib/seo`：`publishedISO`のISO変換（時刻あり/なし）・各JSON-LDビルダの必須フィールド・`absoluteUrl`。

## 検証方法

1. `npm test` 全パス、`tsc` clean。
2. ローカルまたはデプロイ後、記事ページのHTMLに `application/ld+json`（Article + BreadcrumbList）が出力されることを確認。
3. 記事ページの `<head>` に description / canonical / `og:type=article` / `article:published_time` が出力されることを確認。
4. Googleリッチリザルトテスト（search.google.com/test/rich-results）でArticle/BreadcrumbListが認識されることを確認。
5. `https://narrative-broadcast.vercel.app/...` へのアクセスが `https://narrative-broadcast.com/...` へ301されることを確認。
