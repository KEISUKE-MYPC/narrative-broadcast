# タクソノミー2階層化（ドメイン→トピック）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存クリプトのURLを `/{domain}/{topic}/{stamp}` の2階層に移行し、旧URLを301でリダイレクトする。将来のドメイン追加（RWA等）の土台を作る。

**Architecture:** ファイル保存は現状維持（`articles/{YYYY}/{MM}/{stamp}-{cycle}-{topic}.md`）。URL生成を `lib/urls.ts` に集約し、ドメインモデルを `lib/taxonomy.ts` に追加。App Router の新ルート `app/[domain]/…` を作り旧 `app/c`・`app/articles` を削除、`middleware.ts` で旧URLを301。

**Tech Stack:** Next.js App Router / TypeScript / vitest / Vercel（middlewareはフルNode）。

## Global Constraints

- 言語・コメントは日本語。テストは vitest（`npx vitest run <path>`）。型は `npx tsc --noEmit`、ビルドは `npm run build`。
- 記事URL＝クリーン形 `/{domain}/{topic}/{timestamp}`（例 `/crypto/btc/2026-06-20-1258`）。日付ディレクトリ・接尾辞は省略。
- トピックハブ＝`/{domain}/{topic}`、ページング＝`/{domain}/{topic}/page/{n}`（n≥2）、ドメインハブ＝`/{domain}`。
- ファイル保存は現状維持。URL/ルーティング層のみ変更。
- 登録ドメインは `crypto` のみ。topic（btc/eth/xrp/sol/weekly）は全て `domain:'crypto'`。
- 週次は `/crypto/weekly`。
- リダイレクトは全て301（恒久）。`next.config.mjs` の既存リダイレクト（vercel.app→.com）は維持。
- timestamp 形式は `YYYY-MM-DD-HHMM`（slug 末尾ファイル名の先頭16文字）。
- topic 判定は既存 `categoryFromSlug`（ファイル名末尾 `-([a-z0-9]+)$`）。
- RWA等の新ドメイン中身・パイプライン抽象化・ナビのドメイン束ね表示は対象外（YAGNI）。

---

## File Structure

| ファイル | 責務 |
|---|---|
| `lib/taxonomy.ts`（新規） | DOMAINS レジストリ＋ドメインヘルパ |
| `lib/categories.ts`（修正） | Category に `domain` 追加 |
| `lib/urls.ts`（新規） | URL生成の単一の真実 |
| `lib/articles.ts`（修正） | stamp+topic→slug 解決 |
| `lib/redirects.ts`（新規） | 旧→新URLの純変換 |
| `middleware.ts`（新規） | 旧URLを301 |
| `app/[domain]/page.tsx`（新規） | ドメインハブ |
| `app/[domain]/[topic]/page.tsx`（新規） | トピックハブ（旧 /c/[slug]） |
| `app/[domain]/[topic]/page/[page]/page.tsx`（新規） | トピックページング |
| `app/[domain]/[topic]/[stamp]/page.tsx`（新規） | 記事（旧 /articles/[...slug]） |
| `app/c/`・`app/articles/`（削除） | 旧ルート撤去 |
| `components/Pagination.tsx`（修正） | `pageHref` 対応 |
| `components/ArticleList.tsx`・`SiteNav.tsx`（修正） | リンクを urls 経由へ |
| `lib/seo.ts`（修正） | JSON-LD URL を新URLへ |
| `app/sitemap.ts`（修正） | 新URL群を出力 |

---

## Task 1: ドメインモデル（taxonomy ＋ Category.domain）

**Files:**
- Create: `lib/taxonomy.ts`
- Modify: `lib/categories.ts`
- Test: `lib/taxonomy.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `Category`（`lib/categories.ts`）。
- Produces: `Domain` 型、`DOMAINS`、`DEFAULT_DOMAIN`、`getDomain(slug)`、`domainOf(topicSlug)`、`topicsInDomain(domainSlug)`。`Category` に `domain: string`。

- [ ] **Step 1: 失敗するテストを書く**

`lib/taxonomy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DOMAINS, getDomain, domainOf, topicsInDomain } from './taxonomy';

describe('taxonomy', () => {
  it('crypto ドメインが登録されている', () => {
    expect(DOMAINS.map((d) => d.slug)).toContain('crypto');
  });
  it('getDomain は未登録で undefined', () => {
    expect(getDomain('crypto')?.slug).toBe('crypto');
    expect(getDomain('rwa')).toBeUndefined();
  });
  it('domainOf は topic→ドメイン、未知は crypto', () => {
    expect(domainOf('btc')).toBe('crypto');
    expect(domainOf('weekly')).toBe('crypto');
    expect(domainOf('unknown')).toBe('crypto');
  });
  it('topicsInDomain は crypto の全トピックを返す', () => {
    const slugs = topicsInDomain('crypto').map((c) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(['btc', 'eth', 'xrp', 'sol', 'weekly']));
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run lib/taxonomy.test.ts`
Expected: FAIL（`lib/taxonomy` 未作成）

- [ ] **Step 3: Category に domain を追加**

`lib/categories.ts` の `Category` 型に1行追加：

```ts
  brandGradient?: [string, string]; // 線をグラデにする場合の[開始,終了]（例: SOLの紫→緑）
  metaCategory?: boolean; // 横断メタカテゴリ（銘柄別強度チャートから除外する）
  domain: string; // 所属ドメイン（例: 'crypto'）
};
```

そして `CATEGORIES` の全エントリに `domain: 'crypto',` を追加（btc/eth/xrp/sol/weekly の各オブジェクトに1行ずつ）。例（btc）：

```ts
  {
    slug: 'btc',
    label: 'Bitcoin ナラティブ',
    short: 'BTC',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: '₿',
    accent: 'var(--accent)',
    ogAccent: '#5cc6da',
    brand: '#F7931A',
    domain: 'crypto',
  },
```

他の eth/xrp/sol/weekly エントリにも同様に `domain: 'crypto',` を追加すること。

- [ ] **Step 4: lib/taxonomy.ts を実装**

```ts
import { CATEGORIES, type Category } from './categories';

export type Domain = {
  slug: string;      // 'crypto'
  label: string;     // 'Crypto'
  description: string;
  order: number;
};

// 登録ドメイン。RWA等は中身ができたらここに追加する。
export const DOMAINS: Domain[] = [
  { slug: 'crypto', label: 'Crypto', description: '暗号資産市場の語りと認知を構造分析', order: 1 },
];

export const DEFAULT_DOMAIN = 'crypto';

const BY_SLUG = new Map(DOMAINS.map((d) => [d.slug, d]));

export function getDomain(slug: string): Domain | undefined {
  return BY_SLUG.get(slug);
}

// topic(slug) → 所属ドメインslug。未登録は DEFAULT_DOMAIN にフォールバック。
export function domainOf(topicSlug: string): string {
  return CATEGORIES.find((c) => c.slug === topicSlug)?.domain ?? DEFAULT_DOMAIN;
}

// 指定ドメインに属する topic 一覧（登録順）。
export function topicsInDomain(domainSlug: string): Category[] {
  return CATEGORIES.filter((c) => c.domain === domainSlug);
}
```

- [ ] **Step 5: テストと型チェックを確認**

Run: `npx vitest run lib/taxonomy.test.ts && npx tsc --noEmit`
Expected: PASS／型エラー無し（Category に domain 必須を足したので全エントリに付いていること）

- [ ] **Step 6: コミット**

```bash
git add lib/taxonomy.ts lib/taxonomy.test.ts lib/categories.ts
git commit -m "feat(taxonomy): ドメインモデルとCategory.domainを追加"
```

---

## Task 2: URL生成ヘルパ（lib/urls.ts）

**Files:**
- Create: `lib/urls.ts`
- Test: `lib/urls.test.ts`

**Interfaces:**
- Consumes: `categoryFromSlug`（`lib/categories.ts`）、`domainOf`（`lib/taxonomy.ts`）。
- Produces: `stampFromSlug(slug)`、`articleUrl(slug)`、`topicHubUrl(topicSlug, page?)`、`domainHubUrl(domainSlug)`。

- [ ] **Step 1: 失敗するテストを書く**

`lib/urls.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stampFromSlug, articleUrl, topicHubUrl, domainHubUrl } from './urls';

describe('urls', () => {
  it('stampFromSlug は先頭のタイムスタンプを返す', () => {
    expect(stampFromSlug('2026/06/2026-06-20-1258-6h-btc')).toBe('2026-06-20-1258');
  });
  it('articleUrl は /{domain}/{topic}/{stamp}', () => {
    expect(articleUrl('2026/06/2026-06-20-1258-6h-btc')).toBe('/crypto/btc/2026-06-20-1258');
    expect(articleUrl('2026/06/2026-06-20-1258-7d-weekly')).toBe('/crypto/weekly/2026-06-20-1258');
  });
  it('topicHubUrl はページ有無で分岐', () => {
    expect(topicHubUrl('btc')).toBe('/crypto/btc');
    expect(topicHubUrl('btc', 1)).toBe('/crypto/btc');
    expect(topicHubUrl('btc', 2)).toBe('/crypto/btc/page/2');
  });
  it('domainHubUrl は /{domain}', () => {
    expect(domainHubUrl('crypto')).toBe('/crypto');
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run lib/urls.test.ts`
Expected: FAIL（`lib/urls` 未作成）

- [ ] **Step 3: lib/urls.ts を実装**

```ts
import { categoryFromSlug } from './categories';
import { domainOf } from './taxonomy';

// 記事slug '2026/06/2026-06-20-1258-6h-btc' から 'YYYY-MM-DD-HHMM' を取り出す。
export function stampFromSlug(slug: string): string {
  const file = slug.split('/').pop() ?? slug;
  const m = file.match(/^(\d{4}-\d{2}-\d{2}-\d{4})/);
  return m ? m[1] : file;
}

// 記事URL: /{domain}/{topic}/{stamp}
export function articleUrl(slug: string): string {
  const topic = categoryFromSlug(slug).slug;
  return `/${domainOf(topic)}/${topic}/${stampFromSlug(slug)}`;
}

// トピックハブ: /{domain}/{topic}（page>=2 は /page/{n}）
export function topicHubUrl(topicSlug: string, page?: number): string {
  const base = `/${domainOf(topicSlug)}/${topicSlug}`;
  return page && page >= 2 ? `${base}/page/${page}` : base;
}

// ドメインハブ: /{domain}
export function domainHubUrl(domainSlug: string): string {
  return `/${domainSlug}`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/urls.test.ts && npx tsc --noEmit`
Expected: PASS／型エラー無し

- [ ] **Step 5: コミット**

```bash
git add lib/urls.ts lib/urls.test.ts
git commit -m "feat(urls): URL生成ヘルパ(article/topicHub/domainHub)を追加"
```

---

## Task 3: 記事ファイル解決（stamp+topic→slug）

**Files:**
- Modify: `lib/articles.ts`
- Test: `lib/articles.test.ts`（新規）

**Interfaces:**
- Consumes: `getArticleSlugs`（既存）。
- Produces: `findSlugByStampTopic(slugs: string[], stamp: string, topic: string): string | null`（純関数）、`resolveArticleByStampTopic(stamp: string, topic: string): string | null`（ラッパ）。

- [ ] **Step 1: 失敗するテストを書く**

`lib/articles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findSlugByStampTopic } from './articles';

const SLUGS = [
  '2026/06/2026-06-20-1258-6h-btc',
  '2026/06/2026-06-20-1258-7d-weekly',
  '2026/06/2026-06-19-1800-6h-eth',
];

describe('findSlugByStampTopic', () => {
  it('stamp と topic に一致する slug を返す', () => {
    expect(findSlugByStampTopic(SLUGS, '2026-06-20-1258', 'btc')).toBe('2026/06/2026-06-20-1258-6h-btc');
    expect(findSlugByStampTopic(SLUGS, '2026-06-20-1258', 'weekly')).toBe('2026/06/2026-06-20-1258-7d-weekly');
  });
  it('一致が無ければ null', () => {
    expect(findSlugByStampTopic(SLUGS, '2026-06-20-1258', 'sol')).toBeNull();
    expect(findSlugByStampTopic(SLUGS, '2099-01-01-0000', 'btc')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run lib/articles.test.ts`
Expected: FAIL（`findSlugByStampTopic` 未定義）

- [ ] **Step 3: lib/articles.ts に追加**

`lib/articles.ts` の末尾に追加（既存の export はそのまま）：

```ts
// slug一覧から、ファイル名が「{stamp}-…-{topic}」に一致するものを返す（純関数）。
export function findSlugByStampTopic(slugs: string[], stamp: string, topic: string): string | null {
  return slugs.find((s) => {
    const file = s.split('/').pop() ?? s;
    return file.startsWith(`${stamp}-`) && file.endsWith(`-${topic}`);
  }) ?? null;
}

// stamp + topic から記事slugを解決する（無ければ null）。
export function resolveArticleByStampTopic(stamp: string, topic: string): string | null {
  return findSlugByStampTopic(getArticleSlugs(), stamp, topic);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/articles.test.ts && npx tsc --noEmit`
Expected: PASS／型エラー無し

- [ ] **Step 5: コミット**

```bash
git add lib/articles.ts lib/articles.test.ts
git commit -m "feat(articles): stamp+topicから記事slugを解決するヘルパを追加"
```

---

## Task 4: リダイレクト（lib/redirects ＋ middleware）

**Files:**
- Create: `lib/redirects.ts`
- Create: `middleware.ts`（プロジェクトルート）
- Test: `lib/redirects.test.ts`

**Interfaces:**
- Consumes: `domainOf`（`lib/taxonomy.ts`）。
- Produces: `legacyRedirect(pathname: string): string | null`。`middleware.ts`（Next middleware）。

- [ ] **Step 1: 失敗するテストを書く**

`lib/redirects.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { legacyRedirect } from './redirects';

describe('legacyRedirect', () => {
  it('旧記事URL → 新記事URL', () => {
    expect(legacyRedirect('/articles/2026/06/2026-06-20-1258-6h-btc'))
      .toBe('/crypto/btc/2026-06-20-1258');
    expect(legacyRedirect('/articles/2026/06/2026-06-20-1258-7d-weekly'))
      .toBe('/crypto/weekly/2026-06-20-1258');
  });
  it('旧カテゴリハブ → 新トピックハブ', () => {
    expect(legacyRedirect('/c/btc')).toBe('/crypto/btc');
    expect(legacyRedirect('/c/btc/')).toBe('/crypto/btc');
  });
  it('旧カテゴリページング → 新ページング', () => {
    expect(legacyRedirect('/c/btc/2')).toBe('/crypto/btc/page/2');
  });
  it('対象外は null', () => {
    expect(legacyRedirect('/')).toBeNull();
    expect(legacyRedirect('/archive')).toBeNull();
    expect(legacyRedirect('/crypto/btc/2026-06-20-1258')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run lib/redirects.test.ts`
Expected: FAIL（`lib/redirects` 未作成）

- [ ] **Step 3: lib/redirects.ts を実装**

```ts
import { domainOf } from './taxonomy';

// 旧URL → 新URL。対象外（既に新URL・静的ルート等）は null。
export function legacyRedirect(pathname: string): string | null {
  // /articles/{y}/{m}/{file}
  const art = pathname.match(/^\/articles\/(.+?)\/?$/);
  if (art) {
    const file = art[1].split('/').pop() ?? art[1];
    const stamp = (file.match(/^(\d{4}-\d{2}-\d{2}-\d{4})/) ?? [])[1];
    const topic = (file.match(/-([a-z0-9]+)$/) ?? [])[1];
    if (!stamp || !topic) return null;
    return `/${domainOf(topic)}/${topic}/${stamp}`;
  }
  // /c/{topic}/{n}
  const cPaged = pathname.match(/^\/c\/([a-z0-9]+)\/(\d+)\/?$/);
  if (cPaged) {
    const [, topic, n] = cPaged;
    const base = `/${domainOf(topic)}/${topic}`;
    return Number(n) >= 2 ? `${base}/page/${n}` : base;
  }
  // /c/{topic}
  const cHub = pathname.match(/^\/c\/([a-z0-9]+)\/?$/);
  if (cHub) {
    const topic = cHub[1];
    return `/${domainOf(topic)}/${topic}`;
  }
  return null;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/redirects.test.ts`
Expected: PASS

- [ ] **Step 5: middleware.ts を作成**

プロジェクトルート `middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { legacyRedirect } from '@/lib/redirects';

export function middleware(req: NextRequest) {
  const dest = legacyRedirect(req.nextUrl.pathname);
  if (dest) {
    const url = req.nextUrl.clone();
    url.pathname = dest;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

// 旧URLだけを対象にする（新URL・静的アセットには干渉しない）
export const config = {
  matcher: ['/articles/:path*', '/c/:path*'],
};
```

- [ ] **Step 6: 型チェックを確認**

Run: `npx tsc --noEmit`
Expected: 型エラー無し

- [ ] **Step 7: コミット**

```bash
git add lib/redirects.ts lib/redirects.test.ts middleware.ts
git commit -m "feat(redirects): 旧URLを新URLへ301するmiddlewareを追加"
```

---

## Task 5: 記事ルート移行（新ルート＋旧/articles削除＋リンク差し替え）

**Files:**
- Create: `app/[domain]/[topic]/[stamp]/page.tsx`
- Delete: `app/articles/`（ディレクトリごと）
- Modify: `components/ArticleList.tsx`
- Modify: `lib/seo.ts`
- Test: 既存ビルド＋型（ルートは結合テストで検証）

**Interfaces:**
- Consumes: `resolveArticleByStampTopic`（Task 3）、`articleUrl`/`stampFromSlug`（Task 2）、`domainOf`（Task 1）、既存 `getArticleSlugs`/`renderMarkdown`/`categoryFromSlug`/`getIndexRowBySlug`/`getArticleDescription`/`getRelatedRows`/`shortTitle`/各コンポーネント。

- [ ] **Step 1: 新記事ルートを作成**

`app/[domain]/[topic]/[stamp]/page.tsx`（旧 `app/articles/[...slug]/page.tsx` を移植。slug は stamp+topic から解決）：

```tsx
import { getArticleSlugs, getArticleBySlug, resolveArticleByStampTopic } from '@/lib/articles';
import { renderMarkdown, extractToc } from '@/lib/markdown';
import { categoryFromSlug } from '@/lib/categories';
import { domainOf } from '@/lib/taxonomy';
import { stampFromSlug, articleUrl } from '@/lib/urls';
import { getIndexRowBySlug } from '@/lib/index-parser';
import { Eyecatch } from '@/components/Eyecatch';
import { TableOfContents } from '@/components/TableOfContents';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { articleJsonLd, breadcrumbJsonLd, publishedISO } from '@/lib/seo';
import { getArticleDescription } from '@/lib/excerpt';
import { ArticleList } from '@/components/ArticleList';
import { getRelatedRows } from '@/lib/related';
import { shortTitle } from '@/lib/title';

export const dynamicParams = false;

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => {
    const topic = categoryFromSlug(slug).slug;
    return { domain: domainOf(topic), topic, stamp: stampFromSlug(slug) };
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; topic: string; stamp: string }>;
}) {
  const { domain, topic, stamp } = await params;
  const slugPath = resolveArticleByStampTopic(stamp, topic);
  if (!slugPath) return {};
  const row = getIndexRowBySlug(slugPath);
  const title = shortTitle(row?.narrative ?? 'ナラティブ分析');
  const ogImage = `/og/${categoryFromSlug(slugPath).slug}`;
  const description = getArticleDescription(slugPath);
  const canonical = `/${domain}/${topic}/${stamp}`;
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
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ domain: string; topic: string; stamp: string }>;
}) {
  const { topic, stamp } = await params;
  const slugPath = resolveArticleByStampTopic(stamp, topic);
  if (!slugPath) notFound();
  const article = getArticleBySlug(slugPath);
  if (!article) notFound();
  const html = await renderMarkdown(article.raw);
  const toc = extractToc(html);
  const cat = categoryFromSlug(slugPath);
  const row = getIndexRowBySlug(slugPath);
  const description = getArticleDescription(slugPath);
  const ogImage = `/og/${cat.slug}`;
  const seoData = [
    articleJsonLd({ slug: slugPath, title: shortTitle(row?.narrative ?? 'ナラティブ分析'), description, image: ogImage }),
    breadcrumbJsonLd({ slug: slugPath, categoryShort: cat.short }),
  ];
  const related = getRelatedRows(slugPath);

  return (
    <>
      <JsonLd data={seoData} />
      <div className="container article-layout">
      <div className="article-col">
        <nav className="crumbs" aria-label="パンくず">
          <a href="/">ホーム</a>
          <span className="crumbs-sep" aria-hidden="true">›</span>
          <a href="/archive">アーカイブ</a>
          <span className="crumbs-sep" aria-hidden="true">›</span>
          <span className="cat-chip">{cat.short}</span>
        </nav>
        <Eyecatch
          slug={slugPath}
          strength={row?.strength}
          datetime={row?.datetime}
          variant="hero"
        />
        <article className="article" dangerouslySetInnerHTML={{ __html: html }} />
        {related.length > 0 && (
          <section className="related-articles">
            <h2 className="section-title">
              <span className="ja">関連する分析</span>
            </h2>
            <ArticleList rows={related} />
          </section>
        )}
      </div>
      <TableOfContents items={toc} />
    </div>
    </>
  );
}
```

- [ ] **Step 2: 旧記事ルートを削除**

```bash
git rm -r app/articles
```

- [ ] **Step 3: ArticleList のリンクを新URLへ**

`components/ArticleList.tsx` の import と href を変更：

```tsx
import type { IndexRow } from '@/lib/index-parser';
import { Eyecatch } from '@/components/Eyecatch';
import { articleUrl } from '@/lib/urls';

export function ArticleList({ rows }: { rows: IndexRow[] }) {
  return (
    <ul className="card-grid">
      {rows.map((r) => (
        <li key={r.slug} className="analysis-card">
          <a href={articleUrl(r.slug)}>
```

（以降の中身は変更なし）

- [ ] **Step 4: seo.ts の記事URLを新URLへ**

`lib/seo.ts` の冒頭に import を追加し、`articleJsonLd`・`breadcrumbJsonLd` の URL を差し替え：

```ts
import { articleUrl } from './urls';
```

`articleJsonLd` 内：

```ts
  const url = absoluteUrl(articleUrl(args.slug));
```

`breadcrumbJsonLd` 内の position 3：

```ts
      { '@type': 'ListItem', position: 3, name: args.categoryShort, item: absoluteUrl(articleUrl(args.slug)) },
```

- [ ] **Step 5: ビルドと型を確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 型エラー無し／ビルド成功。新ルート `/crypto/btc/<stamp>` 等が静的生成されること（ビルドログのルート一覧に `/[domain]/[topic]/[stamp]` が出る）。

- [ ] **Step 6: コミット**

```bash
git add app/[domain] components/ArticleList.tsx lib/seo.ts
git rm -r --cached app/articles 2>/dev/null || true
git commit -m "feat(routes): 記事URLを/{domain}/{topic}/{stamp}へ移行し旧/articlesを削除"
```

---

## Task 6: トピックハブ＋ページング移行（新ルート＋旧/c削除＋Pagination/SiteNav）

**Files:**
- Create: `app/[domain]/[topic]/page.tsx`
- Create: `app/[domain]/[topic]/page/[page]/page.tsx`
- Delete: `app/c/`（ディレクトリごと）
- Modify: `components/Pagination.tsx`
- Modify: `components/SiteNav.tsx`

**Interfaces:**
- Consumes: `topicHubUrl`（Task 2）、`domainOf`/`topicsInDomain`（Task 1）、既存 `getIndexRows`/`CATEGORIES`/`getCategory`/`categoryFromSlug`/`ArticleList`/`Pagination`/`NarrativeChart`/`ARCHIVE_PER_PAGE`。
- Produces: `Pagination` に optional `pageHref?: (n: number) => string`。

- [ ] **Step 1: Pagination に pageHref を追加**

`components/Pagination.tsx` を変更（`pageHref` 指定時はそれを優先。未指定なら従来の basePath 方式）：

```tsx
export function Pagination({
  current,
  total,
  basePath = '/archive',
  pageHref,
}: {
  current: number;
  total: number;
  basePath?: string;
  pageHref?: (n: number) => string;
}) {
  if (total <= 1) return null;
  const link = (p: number) => (pageHref ? pageHref(p) : href(basePath, p));
  const items = pageItems(current, total);

  return (
    <nav className="pagination" aria-label="ページ送り">
      {current > 1 && (
        <a className="pg-link" href={link(current - 1)} rel="prev">
          ← 前へ
        </a>
      )}
      <ul className="pg-list">
        {items.map((it, i) =>
          it === '…' ? (
            <li key={`e${i}`} className="pg-ellipsis" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={it}>
              {it === current ? (
                <span className="pg-num is-current" aria-current="page">
                  {it}
                </span>
              ) : (
                <a className="pg-num" href={link(it)}>
                  {it}
                </a>
              )}
            </li>
          ),
        )}
      </ul>
      {current < total && (
        <a className="pg-link" href={link(current + 1)} rel="next">
          次へ →
        </a>
      )}
    </nav>
  );
}
```

（`href` ヘルパと `pageItems` は既存のまま残す）

- [ ] **Step 2: トピックハブルートを作成**

`app/[domain]/[topic]/page.tsx`（旧 `app/c/[slug]/page.tsx` を移植）：

```tsx
import { notFound } from 'next/navigation';
import { getIndexRows } from '@/lib/index-parser';
import { getCategory, categoryFromSlug } from '@/lib/categories';
import { domainOf, topicsInDomain, DOMAINS } from '@/lib/taxonomy';
import { topicHubUrl } from '@/lib/urls';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';
import { NarrativeChart, type ChartPoint } from '@/components/NarrativeChart';

export const dynamicParams = false;

export function generateStaticParams() {
  // 全ドメイン×そのトピック
  const params: { domain: string; topic: string }[] = [];
  for (const d of DOMAINS) {
    for (const c of topicsInDomain(d.slug)) params.push({ domain: d.slug, topic: c.slug });
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string; topic: string }> }) {
  const { domain, topic } = await params;
  const cat = getCategory(topic);
  const canonical = topicHubUrl(topic);
  const ogImage = `/og/${topic}`;
  return {
    title: cat.label,
    description: cat.description,
    alternates: { canonical },
    openGraph: { type: 'website', title: cat.label, description: cat.description, url: canonical, images: [ogImage] },
    twitter: { card: 'summary_large_image', title: cat.label, description: cat.description, images: [ogImage] },
  };
}

export default async function TopicHub({ params }: { params: Promise<{ domain: string; topic: string }> }) {
  const { domain, topic } = await params;
  // 未登録/ドメイン不一致は404
  if (domainOf(topic) !== domain || !topicsInDomain(domain).some((c) => c.slug === topic)) notFound();
  const cat = getCategory(topic);

  const rows = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === topic);
  const points: ChartPoint[] = rows.map((r) => ({ datetime: r.datetime, strength: r.strength, narrative: r.narrative }));
  const total = Math.max(1, Math.ceil(rows.length / ARCHIVE_PER_PAGE));
  const pageRows = rows.slice(0, ARCHIVE_PER_PAGE);

  return (
    <div className="container">
      <header className="cat-head">
        <span className="cat-head-chip">{cat.short}</span>
        <h1 className="page-title">{cat.label}</h1>
        <p className="cat-head-desc">{cat.description}</p>
      </header>

      {points.length > 0 && (
        <section className="section">
          <h2 className="section-title"><span className="ja">強度の推移</span></h2>
          <div className="chart-frame">
            <NarrativeChart data={points} color={cat.brand} gradient={cat.brandGradient} />
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title"><span className="ja">分析一覧</span></h2>
        {rows.length > 0 ? (
          <>
            <ArticleList rows={pageRows} />
            <Pagination current={1} total={total} pageHref={(n) => topicHubUrl(topic, n)} />
          </>
        ) : (
          <p className="cat-empty">この分野の分析はまだありません。</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: トピックページングルートを作成**

`app/[domain]/[topic]/page/[page]/page.tsx`（旧 `app/c/[slug]/[page]/page.tsx` を移植）：

```tsx
import { notFound } from 'next/navigation';
import { getIndexRows } from '@/lib/index-parser';
import { getCategory, categoryFromSlug } from '@/lib/categories';
import { domainOf, topicsInDomain, DOMAINS } from '@/lib/taxonomy';
import { topicHubUrl } from '@/lib/urls';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';

export const dynamicParams = false;

function totalPages(topic: string): number {
  const n = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === topic).length;
  return Math.max(1, Math.ceil(n / ARCHIVE_PER_PAGE));
}

export function generateStaticParams() {
  const params: { domain: string; topic: string; page: string }[] = [];
  for (const d of DOMAINS) {
    for (const c of topicsInDomain(d.slug)) {
      const total = totalPages(c.slug);
      for (let p = 2; p <= total; p++) params.push({ domain: d.slug, topic: c.slug, page: String(p) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; topic: string; page: string }>;
}) {
  const { topic, page } = await params;
  const cat = getCategory(topic);
  return {
    title: `${cat.label} (${page}ページ目)`,
    description: cat.description,
    alternates: { canonical: topicHubUrl(topic, Number(page)) },
  };
}

export default async function TopicPaged({
  params,
}: {
  params: Promise<{ domain: string; topic: string; page: string }>;
}) {
  const { domain, topic, page } = await params;
  if (domainOf(topic) !== domain || !topicsInDomain(domain).some((c) => c.slug === topic)) notFound();
  const cat = getCategory(topic);

  const rows = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === topic);
  const n = Number(page);
  const total = Math.max(1, Math.ceil(rows.length / ARCHIVE_PER_PAGE));
  if (!Number.isInteger(n) || n < 2 || n > total) notFound();

  const pageRows = rows.slice((n - 1) * ARCHIVE_PER_PAGE, n * ARCHIVE_PER_PAGE);

  return (
    <div className="container">
      <header className="cat-head">
        <span className="cat-head-chip">{cat.short}</span>
        <h1 className="page-title">
          {cat.label} <span className="page-sub">{n} / {total}</span>
        </h1>
      </header>

      <section className="section">
        <ArticleList rows={pageRows} />
        <Pagination current={n} total={total} pageHref={(p) => topicHubUrl(topic, p)} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: 旧カテゴリルートを削除**

```bash
git rm -r app/c
```

- [ ] **Step 5: SiteNav のリンクを新URLへ**

`components/SiteNav.tsx` を変更：

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';
import { topicHubUrl } from '@/lib/urls';

export function SiteNav() {
  const pathname = usePathname();
  if (CATEGORIES.length <= 1) return null;

  return (
    <nav className="site-nav" aria-label="分野">
      <div className="site-nav-inner">
        {CATEGORIES.map((c) => {
          const href = topicHubUrl(c.slug);
          const active = pathname?.startsWith(href);
          return (
            <a
              key={c.slug}
              href={href}
              className={active ? 'is-active' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {c.short}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: ビルドと型を確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 型エラー無し／ビルド成功。`/[domain]/[topic]` と `/[domain]/[topic]/page/[page]` がルート一覧に出る。`/crypto/btc/page/2` 等が生成される。

- [ ] **Step 7: コミット**

```bash
git add app/[domain] components/Pagination.tsx components/SiteNav.tsx
git rm -r --cached app/c 2>/dev/null || true
git commit -m "feat(routes): トピックハブ/ページングを2階層URLへ移行し旧/cを削除"
```

---

## Task 7: ドメインハブルート（/crypto）

**Files:**
- Create: `app/[domain]/page.tsx`

**Interfaces:**
- Consumes: `getDomain`/`topicsInDomain`/`domainOf`/`DOMAINS`（Task 1）、`topicHubUrl`/`domainHubUrl`（Task 2）、`getIndexRows`/`categoryFromSlug`/`ArticleList`。

- [ ] **Step 1: ドメインハブルートを作成**

`app/[domain]/page.tsx`：

```tsx
import { notFound } from 'next/navigation';
import { getDomain, topicsInDomain, domainOf, DOMAINS } from '@/lib/taxonomy';
import { topicHubUrl, domainHubUrl } from '@/lib/urls';
import { getIndexRows } from '@/lib/index-parser';
import { categoryFromSlug } from '@/lib/categories';
import { ArticleList } from '@/components/ArticleList';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';

export const dynamicParams = false;

export function generateStaticParams() {
  return DOMAINS.map((d) => ({ domain: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const d = getDomain(domain);
  if (!d) return {};
  return {
    title: d.label,
    description: d.description,
    alternates: { canonical: domainHubUrl(domain) },
    openGraph: { type: 'website', title: d.label, description: d.description, url: domainHubUrl(domain) },
  };
}

export default async function DomainHub({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const d = getDomain(domain);
  if (!d) notFound();

  const topics = topicsInDomain(domain);
  // ドメイン内の最新記事（INDEXは新しい順）
  const rows = getIndexRows()
    .filter((r) => domainOf(categoryFromSlug(r.slug).slug) === domain)
    .slice(0, ARCHIVE_PER_PAGE);

  return (
    <div className="container">
      <header className="cat-head">
        <h1 className="page-title">{d.label}</h1>
        <p className="cat-head-desc">{d.description}</p>
      </header>

      <section className="section">
        <h2 className="section-title"><span className="ja">トピック</span></h2>
        <ul className="card-grid">
          {topics.map((c) => (
            <li key={c.slug} className="analysis-card">
              <a href={topicHubUrl(c.slug)}>
                <div className="ac-body">
                  <h3 className="ac-title">{c.label}</h3>
                  <span className="ac-delta">{c.description}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {rows.length > 0 && (
        <section className="section">
          <h2 className="section-title"><span className="ja">最新の分析</span></h2>
          <ArticleList rows={rows} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルドと型を確認**

Run: `npx tsc --noEmit && npm run build`
Expected: 型エラー無し／ビルド成功。`/[domain]`（`/crypto`）がルート一覧に出る。

- [ ] **Step 3: コミット**

```bash
git add app/[domain]/page.tsx
git commit -m "feat(routes): ドメインハブ /{domain} を追加"
```

---

## Task 8: sitemap 刷新＋最終検証

**Files:**
- Modify: `app/sitemap.ts`
- Test: `app/sitemap.test.ts`（新規）

**Interfaces:**
- Consumes: `DOMAINS`/`topicsInDomain`（Task 1）、`articleUrl`/`topicHubUrl`/`domainHubUrl`（Task 2）、既存 `getArticleSlugs`/`getIndexRows`/`publishedISO`/`ARCHIVE_PER_PAGE`。

- [ ] **Step 1: 失敗するテストを書く**

`app/sitemap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('新URL形（/crypto/...）を含み、旧形（/c/・/articles/）を含まない', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://narrative-broadcast.com/crypto');
    expect(urls).toContain('https://narrative-broadcast.com/crypto/btc');
    expect(urls.some((u) => /\/crypto\/(btc|weekly)\/\d{4}-\d{2}-\d{2}-\d{4}$/.test(u))).toBe(true);
    expect(urls.some((u) => u.includes('/c/'))).toBe(false);
    expect(urls.some((u) => u.includes('/articles/'))).toBe(false);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run app/sitemap.test.ts`
Expected: FAIL（旧 sitemap は `/c/`・`/articles/` を含む）

- [ ] **Step 3: sitemap.ts を新URLへ**

`app/sitemap.ts` を差し替え：

```ts
import type { MetadataRoute } from 'next';
import { getArticleSlugs } from '@/lib/articles';
import { getIndexRows } from '@/lib/index-parser';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';
import { publishedISO } from '@/lib/seo';
import { DOMAINS, topicsInDomain } from '@/lib/taxonomy';
import { articleUrl, topicHubUrl, domainHubUrl } from '@/lib/urls';

const BASE = 'https://narrative-broadcast.com';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = getArticleSlugs();
  const latest = slugs.map(publishedISO).filter(Boolean).sort().at(-1);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: latest, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE}/archive`, lastModified: latest, changeFrequency: 'hourly', priority: 0.8 },
  ];

  // アーカイブ2ページ目以降
  const total = Math.max(1, Math.ceil(getIndexRows().length / ARCHIVE_PER_PAGE));
  const archivePages: MetadataRoute.Sitemap = [];
  for (let p = 2; p <= total; p++) {
    archivePages.push({ url: `${BASE}/archive/${p}`, lastModified: latest, changeFrequency: 'weekly', priority: 0.4 });
  }

  // ドメインハブ /{domain}
  const domainPages: MetadataRoute.Sitemap = DOMAINS.map((d) => ({
    url: `${BASE}${domainHubUrl(d.slug)}`,
    lastModified: latest,
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  // トピックハブ /{domain}/{topic}
  const topicPages: MetadataRoute.Sitemap = DOMAINS.flatMap((d) =>
    topicsInDomain(d.slug).map((c) => ({
      url: `${BASE}${topicHubUrl(c.slug)}`,
      lastModified: latest,
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    })),
  );

  // 記事 /{domain}/{topic}/{stamp}
  const articles: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}${articleUrl(slug)}`,
    lastModified: publishedISO(slug) || undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticPages, ...domainPages, ...topicPages, ...archivePages, ...articles];
}
```

- [ ] **Step 4: テスト・型・ビルドを確認**

Run: `npx vitest run app/sitemap.test.ts && npx tsc --noEmit && npm run build`
Expected: テストPASS／型エラー無し／ビルド成功

- [ ] **Step 5: 全テストとビルドの最終確認**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: 全テストPASS／型エラー無し／ビルド成功。ルート一覧に `/[domain]`・`/[domain]/[topic]`・`/[domain]/[topic]/page/[page]`・`/[domain]/[topic]/[stamp]` が出て、`/c`・`/articles` は無い。

- [ ] **Step 6: コミット**

```bash
git add app/sitemap.ts app/sitemap.test.ts
git commit -m "feat(sitemap): 新URL（domain/topic/article）を出力"
```

---

## Self-Review（計画作成者の確認メモ）

- **Spec coverage**: データモデル=Task1、URL集約=Task2、ファイル解決=Task3、リダイレクト=Task4、記事ルート=Task5、トピックハブ/ページング=Task6、ドメインハブ=Task7、sitemap=Task8。リンク差し替え（ArticleList/SiteNav/seo）=Task5,6。ナビは現状トピックタブのまま新URL（Task6）＝仕様どおり。
- **Placeholder scan**: 全ステップに実コードあり。TODO/TBD無し。
- **Type consistency**: `articleUrl`/`topicHubUrl(slug,page)`/`domainHubUrl`/`stampFromSlug`（Task2定義）をTask5-8で同一シグネチャで使用。`domainOf`/`topicsInDomain`/`DOMAINS`/`getDomain`（Task1）整合。`resolveArticleByStampTopic`/`findSlugByStampTopic`（Task3）整合。`Pagination` の `pageHref?: (n:number)=>string`（Task6定義）をトピック両ルートで使用。
- **既存挙動の非破壊**: `next.config.mjs` の vercel.app→.com は維持（middlewareと共存）。`/og/[...slug]`・`/archive`・home は不変（リンク生成のみ urls 経由へ）。Pagination の archive 用法は `pageHref` 未指定で従来動作。
- **ルート優先**: 静的 `/archive`・`/og`・`page/` は動的 `[domain]`・`[stamp]` より優先解決（Next標準）。`[domain]` は dynamicParams=false で crypto のみ生成。
