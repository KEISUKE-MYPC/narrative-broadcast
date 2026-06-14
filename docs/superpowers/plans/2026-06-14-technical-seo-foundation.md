# 技術SEOの土台を固める 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自動生成記事を検索エンジンに正しく・豊かに伝える技術土台（JSON-LD構造化データ・記事description・canonical・公開日時・ドメイン重複解消）を整備する。

**Architecture:** サイト側コードのみで完結（パイプライン不変）。`lib/seo.ts`（定数・日時・JSON-LDビルダ）と`lib/excerpt.ts`（description抽出）を新設し、`components/JsonLd.tsx`でレンダリング。記事ページ・ルートレイアウト・home/archiveのメタデータを拡充し、`next.config.mjs`で.vercel.app→.comの301リダイレクトを追加。

**Tech Stack:** Next.js App Router (静的生成), TypeScript, Vitest, schema.org JSON-LD

---

## ファイル構成

- Create: `lib/seo.ts` — SEO定数・`publishedISO`・`absoluteUrl`・JSON-LDビルダ群
- Create: `lib/seo.test.ts` — seoヘルパーのテスト
- Create: `lib/excerpt.ts` — `getArticleDescription`（本文からdescription抽出）
- Create: `lib/excerpt.test.ts` — excerptのテスト
- Create: `components/JsonLd.tsx` — `<script type="application/ld+json">` レンダラ
- Modify: `app/layout.tsx` — WebSite+Organization JSON-LDをサイト全体に出力
- Modify: `app/articles/[...slug]/page.tsx` — metadata拡充＋Article/BreadcrumbList JSON-LD
- Modify: `app/page.tsx` — canonical+description
- Modify: `app/archive/page.tsx` — canonical+description
- Modify: `app/archive/[page]/page.tsx` — canonical
- Modify: `next.config.mjs` — .vercel.app→.com 301リダイレクト

参照する既存シグネチャ：
- `lib/articles.ts`: `type Article = { slug: string; raw: string }` / `getArticleBySlug(slug): Article | null`
- `lib/categories.ts`: `categoryFromSlug(slug): Category`（`Category.short` を使用）
- テストは Vitest（`import { describe, it, expect } from 'vitest'`）。lib系は `tests/` ではなくファイル隣接の `*.test.ts` でも可だが、本計画は隣接配置に統一する。

---

### Task 1: `lib/seo.ts` の定数とユーティリティ（publishedISO / absoluteUrl）

**Files:**
- Create: `lib/seo.ts`
- Create: `lib/seo.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/seo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { publishedISO, absoluteUrl, SITE_URL } from './seo';

describe('publishedISO', () => {
  it('スラッグ末尾の YYYY-MM-DD-HHMM を JST ISO に変換する', () => {
    expect(publishedISO('2026/06/2026-06-14-0047-6h-btc')).toBe('2026-06-14T00:47:00+09:00');
  });
  it('時刻が無ければ日付のみ(00:00 JST)にフォールバック', () => {
    expect(publishedISO('2026/06/2026-06-14-btc')).toBe('2026-06-14T00:00:00+09:00');
  });
  it('日付が全く無ければ空文字', () => {
    expect(publishedISO('foo/bar')).toBe('');
  });
});

describe('absoluteUrl', () => {
  it('SITE_URL とパスを連結する', () => {
    expect(absoluteUrl('/og/btc')).toBe(`${SITE_URL}/og/btc`);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/seo.test.ts`
Expected: FAIL（`./seo` が存在しない）

- [ ] **Step 3: 最小実装を書く**

`lib/seo.ts`:
```ts
export const SITE_URL = 'https://narrative-broadcast.com';
export const SITE_NAME = 'Narrative Broadcast';
export const SITE_DESCRIPTION = '市場参加者の物語と認知を構造分析するナラティブ観測メディア';

export function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path}`;
}

// スラッグ末尾の日時から JST(+09:00) の ISO8601 を生成する
export function publishedISO(slug: string): string {
  const last = slug.split('/').pop() ?? slug;
  const dt = last.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/);
  if (dt) {
    const [, y, mo, d, h, mi] = dt;
    return `${y}-${mo}-${d}T${h}:${mi}:00+09:00`;
  }
  const dOnly = last.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dOnly) {
    const [, y, mo, d] = dOnly;
    return `${y}-${mo}-${d}T00:00:00+09:00`;
  }
  return '';
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/seo.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: コミット**

```bash
git add lib/seo.ts lib/seo.test.ts
git commit -m "feat(seo): SEO定数とpublishedISO/absoluteUrlを追加"
```

---

### Task 2: `lib/excerpt.ts` — 本文からdescription抽出

**Files:**
- Create: `lib/excerpt.ts`
- Create: `lib/excerpt.test.ts`

> 注: `getArticleDescription` はファイルI/O（`getArticleBySlug`）に依存するため、抽出ロジックは純粋関数 `extractDescription(raw, maxLen)` に分離してテストする。

- [ ] **Step 1: 失敗するテストを書く**

`lib/excerpt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { extractDescription } from './excerpt';

const SAMPLE = [
  '> ⚠️ 自動生成｜6ソース',
  '',
  '# マスクの語彙がBTCを攫う',
  '',
  '## 現在の支配的ナラティブ',
  'トレンド語彙の上位を `spcx`・`musk` が占め、BTCは **-49.08%** に位置する。',
  '',
  '## 構造分析',
].join('\n');

describe('extractDescription', () => {
  it('引用・H1・H2をスキップし最初の実段落を採用する', () => {
    const d = extractDescription(SAMPLE, 200);
    expect(d.startsWith('トレンド語彙の上位を')).toBe(true);
  });
  it('Markdown記法(コード・太字)を除去する', () => {
    const d = extractDescription(SAMPLE, 200);
    expect(d).toContain('spcx');
    expect(d).not.toContain('`');
    expect(d).not.toContain('**');
    expect(d).toContain('-49.08%');
  });
  it('maxLenで切り詰め…を付ける', () => {
    const d = extractDescription(SAMPLE, 10);
    expect(d.endsWith('…')).toBe(true);
    expect(d.length).toBe(11);
  });
  it('実段落が無ければ空文字を返す', () => {
    expect(extractDescription('# 見出しだけ\n\n> 引用だけ', 100)).toBe('');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/excerpt.test.ts`
Expected: FAIL（`./excerpt` が存在しない）

- [ ] **Step 3: 最小実装を書く**

`lib/excerpt.ts`:
```ts
import { getArticleBySlug } from './articles';
import { SITE_DESCRIPTION } from './seo';

function stripMarkdown(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '$1')              // インラインコード
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // 太字
    .replace(/\*([^*]+)\*/g, '$1')            // 強調
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // リンク
    .replace(/\s+/g, ' ')
    .trim();
}

// raw本文から最初の実段落を抽出して整形する純粋関数
export function extractDescription(raw: string, maxLen = 150): string {
  let para = '';
  for (const line of raw.split('\n').map((l) => l.trim())) {
    if (!line) continue;
    if (line.startsWith('#')) continue;       // 見出し
    if (line.startsWith('>')) continue;       // 引用
    if (line.startsWith('|')) continue;       // 表
    if (line.startsWith('<!--')) continue;    // コメント
    if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) continue; // リスト
    para = line;
    break;
  }
  if (!para) return '';
  const clean = stripMarkdown(para);
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen) + '…';
}

// スラッグからdescriptionを得る（抽出失敗時はサイトdescription）
export function getArticleDescription(slug: string, maxLen = 150): string {
  const article = getArticleBySlug(slug);
  if (!article) return SITE_DESCRIPTION;
  return extractDescription(article.raw, maxLen) || SITE_DESCRIPTION;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/excerpt.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: コミット**

```bash
git add lib/excerpt.ts lib/excerpt.test.ts
git commit -m "feat(seo): 本文からmeta description抽出するexcerptを追加"
```

---

### Task 3: `lib/seo.ts` に JSON-LD ビルダを追加

**Files:**
- Modify: `lib/seo.ts`
- Modify: `lib/seo.test.ts`

- [ ] **Step 1: 失敗するテストを追記**

`lib/seo.test.ts` の末尾に追記:
```ts
import {
  websiteJsonLd, organizationJsonLd, articleJsonLd, breadcrumbJsonLd, SITE_NAME,
} from './seo';

describe('JSON-LD builders', () => {
  it('websiteJsonLd は WebSite 型', () => {
    const o = websiteJsonLd() as Record<string, unknown>;
    expect(o['@type']).toBe('WebSite');
    expect(o.name).toBe(SITE_NAME);
    expect(o.inLanguage).toBe('ja');
  });
  it('organizationJsonLd は Organization 型でlogoが絶対URL', () => {
    const o = organizationJsonLd() as Record<string, unknown>;
    expect(o['@type']).toBe('Organization');
    expect(String(o.logo).startsWith('https://')).toBe(true);
  });
  it('articleJsonLd は必須フィールドを持つ', () => {
    const o = articleJsonLd({
      slug: '2026/06/2026-06-14-0047-6h-btc', title: 'T', description: 'D', image: '/og/btc',
    }) as Record<string, unknown>;
    expect(o['@type']).toBe('Article');
    expect(o.headline).toBe('T');
    expect(o.description).toBe('D');
    expect(o.datePublished).toBe('2026-06-14T00:47:00+09:00');
    expect(o.dateModified).toBe('2026-06-14T00:47:00+09:00');
    expect(String(o.image)).toBe('https://narrative-broadcast.com/og/btc');
    expect((o.publisher as Record<string, unknown>)['@type']).toBe('Organization');
  });
  it('breadcrumbJsonLd は3階層', () => {
    const o = breadcrumbJsonLd({ slug: '2026/06/2026-06-14-0047-6h-btc', categoryShort: 'BTC' }) as Record<string, unknown>;
    expect(o['@type']).toBe('BreadcrumbList');
    const items = o.itemListElement as unknown[];
    expect(items.length).toBe(3);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/seo.test.ts`
Expected: FAIL（ビルダ未定義）

- [ ] **Step 3: 実装を追記**

`lib/seo.ts` の末尾に追記:
```ts
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'ja',
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/icon'),
  };
}

export function articleJsonLd(args: {
  slug: string; title: string; description: string; image: string;
}) {
  const url = absoluteUrl(`/articles/${args.slug}`);
  const published = publishedISO(args.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.title,
    description: args.description,
    image: absoluteUrl(args.image),
    datePublished: published,
    dateModified: published,
    inLanguage: 'ja',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon') },
    },
  };
}

export function breadcrumbJsonLd(args: { slug: string; categoryShort: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'アーカイブ', item: absoluteUrl('/archive') },
      { '@type': 'ListItem', position: 3, name: args.categoryShort, item: absoluteUrl(`/articles/${args.slug}`) },
    ],
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/seo.test.ts`
Expected: PASS（全テスト）

- [ ] **Step 5: コミット**

```bash
git add lib/seo.ts lib/seo.test.ts
git commit -m "feat(seo): JSON-LDビルダ(WebSite/Organization/Article/BreadcrumbList)を追加"
```

---

### Task 4: `components/JsonLd.tsx` — JSON-LDレンダラ

**Files:**
- Create: `components/JsonLd.tsx`

- [ ] **Step 1: コンポーネントを作成**

`components/JsonLd.tsx`:
```tsx
// schema.org JSON-LD を <script> として出力する。
// JSON内の '<' をエスケープしてXSSを防ぐ。
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add components/JsonLd.tsx
git commit -m "feat(seo): JSON-LDレンダリング用のJsonLdコンポーネントを追加"
```

---

### Task 5: ルートレイアウトに WebSite+Organization JSON-LD を出力

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: import を追加**

`app/layout.tsx` の既存 import 群（`import { SiteNav } ...` の下）に追加:
```tsx
import { JsonLd } from '@/components/JsonLd';
import { websiteJsonLd, organizationJsonLd } from '@/lib/seo';
```

- [ ] **Step 2: `<body>` 先頭に JsonLd を挿入**

`app/layout.tsx` の `<body>` 直後（`<header className="masthead">` の直前）に追加:
```tsx
        <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add app/layout.tsx
git commit -m "feat(seo): サイト全体にWebSite/Organizationの構造化データを出力"
```

---

### Task 6: 記事ページのメタデータ拡充＋Article/BreadcrumbList JSON-LD

**Files:**
- Modify: `app/articles/[...slug]/page.tsx`

- [ ] **Step 1: import を追加**

`app/articles/[...slug]/page.tsx` の import 群に追加:
```tsx
import { JsonLd } from '@/components/JsonLd';
import { articleJsonLd, breadcrumbJsonLd, publishedISO } from '@/lib/seo';
import { getArticleDescription } from '@/lib/excerpt';
```

- [ ] **Step 2: `generateMetadata` を差し替える**

既存の `generateMetadata` 関数の `return {...}` を以下に置き換える（`title`/`ogImage` 取得部はそのまま残す）:
```tsx
  const description = getArticleDescription(slugPath);
  const canonical = `/articles/${slugPath}`;
  const publishedTime = publishedISO(slugPath);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: [ogImage],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
```

- [ ] **Step 3: ページ本体に JSON-LD を追加**

`ArticlePage` 関数内、`const row = getIndexRowBySlug(slugPath);` の後、`return (` の直前に追加:
```tsx
  const description = getArticleDescription(slugPath);
  const ogImage = `/og/${cat.slug}`;
  const seoData = [
    articleJsonLd({ slug: slugPath, title: row?.narrative ?? 'ナラティブ分析', description, image: ogImage }),
    breadcrumbJsonLd({ slug: slugPath, categoryShort: cat.short }),
  ];
```

そして `return (` 直後の `<div className="container article-layout">` の直前（JSX最上部）に追加:
```tsx
      <JsonLd data={seoData} />
```
※ `<div className="container article-layout">` を `<>` フラグメントで包み、その先頭に `<JsonLd .../>` を置く。具体的には:
```tsx
  return (
    <>
      <JsonLd data={seoData} />
      <div className="container article-layout">
        ...既存のまま...
      </div>
    </>
  );
```

- [ ] **Step 4: 型チェックとビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add "app/articles/[...slug]/page.tsx"
git commit -m "feat(seo): 記事にdescription/canonical/公開日時とArticle/Breadcrumb構造化データを追加"
```

---

### Task 7: home / archive に canonical と description を付与

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/archive/page.tsx`
- Modify: `app/archive/[page]/page.tsx`

- [ ] **Step 1: home にmetadataを追加**

`app/page.tsx` の先頭付近（既存 import の下、コンポーネント定義の前）に追加。既に `metadata` export があれば `alternates` を足す。無ければ新規追加:
```tsx
export const metadata = {
  alternates: { canonical: '/' },
};
```

- [ ] **Step 2: archive にmetadataを追加**

`app/archive/page.tsx` に追加:
```tsx
export const metadata = {
  title: 'アーカイブ',
  description: '過去のナラティブ分析記事の一覧。',
  alternates: { canonical: '/archive' },
};
```

- [ ] **Step 3: archive/[page] にcanonicalを追加**

`app/archive/[page]/page.tsx` に `generateMetadata` を追加（既存があれば `alternates` を統合）:
```tsx
export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  return {
    title: `アーカイブ (${page}ページ目)`,
    alternates: { canonical: `/archive/${page}` },
  };
}
```
※ 既存に `generateMetadata` や `metadata` がある場合は重複定義を避け、`alternates` だけ統合すること。

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add app/page.tsx app/archive/page.tsx "app/archive/[page]/page.tsx"
git commit -m "feat(seo): home/archiveにcanonicalとdescriptionを付与"
```

---

### Task 8: `.vercel.app` → `.com` の301リダイレクト

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: redirects を追加**

`next.config.mjs` を以下に差し替える:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'narrative-broadcast.vercel.app' }],
        destination: 'https://narrative-broadcast.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: 設定が読めることを確認**

Run: `node -e "import('./next.config.mjs').then(m => console.log('redirects:', typeof m.default.redirects))"`
Expected: `redirects: function`

- [ ] **Step 3: コミット**

```bash
git add next.config.mjs
git commit -m "feat(seo): .vercel.appを.comへ301リダイレクト(重複コンテンツ解消)"
```

---

### Task 9: 全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト**

Run: `npm test`
Expected: 全テストPASS（既存＋新規）

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 本番ビルド**

Run: `npm run build`
Expected: ビルド成功（記事ページが静的生成される）

- [ ] **Step 4: 生成HTMLに構造化データが入っているか確認（任意・ローカル）**

Run（ビルド出力から1記事のHTMLを探す）:
```bash
grep -rl 'application/ld+json' .next/server/app/articles 2>/dev/null | head -1
```
Expected: 記事HTMLがヒット（JSON-LD出力を確認）。

- [ ] **Step 5: push**

```bash
git push origin main
```

- [ ] **Step 6: デプロイ後の本番検証**

- 記事ページのソースに `application/ld+json`（Article + BreadcrumbList）が出力されているか
- `<head>` に `description` / `rel=canonical` / `og:type=article` / `article:published_time` があるか
- `https://narrative-broadcast.vercel.app/` が `https://narrative-broadcast.com/` へ301されるか
- Googleリッチリザルトテスト（search.google.com/test/rich-results）でArticle/BreadcrumbListが認識されるか

---

## Self-Review メモ

- **Spec coverage:** ①description抽出=Task2、②seoヘルパー(publishedISO等)=Task1、③JSON-LDビルダ=Task3、JsonLdレンダラ=Task4、④記事メタ拡充=Task6、⑤レイアウトJSON-LD=Task5、⑥home/archive canonical=Task7、⑦ドメインリダイレクト=Task8、テスト=各Task内＋Task9。全項目に対応タスクあり。
- **型整合:** `articleJsonLd`/`breadcrumbJsonLd` の引数名（slug/title/description/image/categoryShort）はTask3定義とTask6呼び出しで一致。`getArticleDescription`/`extractDescription` の分離もTask2内で一貫。
- **Placeholder:** なし。各コードブロックは実値。
- **注意点:** Task6・Task7は既存コードへの差し込みのため、実装時に既存の `metadata`/`generateMetadata` の有無を確認し重複定義を避けること（計画内に明記済み）。
