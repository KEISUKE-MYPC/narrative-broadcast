# BTCナラティブ配信サイト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `articles/` のMarkdownを読み込み、6hナラティブ分析をストリーム公開するNext.jsサイトを作り、Vercelで自動デプロイする。

**Architecture:** 同一リポジトリにNext.js（App Router）を同居。ビルド時に `articles/INDEX.md`（一覧＋強度チャートの構造化ソース）と `articles/**/*.md`（記事本文）を読む。SSG。mainへのpushでVercelが自動再デプロイ。

**Tech Stack:** Next.js (App Router, TypeScript), unified/remark/remark-gfm/remark-rehype/rehype-stringify, gray-matter, Recharts, Vitest。Node 24。デザイン仕上げは別途 Impeccable。

**Spec:** `docs/superpowers/specs/2026-06-06-btc-narrative-site-design.md`

---

## File Structure

```
package.json, tsconfig.json, next.config.mjs, vitest.config.ts   # ルート（アプリ同居）
app/
  layout.tsx           # 全体レイアウト（ヘッダ／フッタ＝免責）
  page.tsx             # トップ（最新＋チャート＋最近の記事）
  globals.css          # 最小スタイル（Impeccableで後で拡張）
  articles/[...slug]/page.tsx   # 個別記事
  archive/page.tsx     # 全記事一覧
lib/
  index-parser.ts      # INDEX.md → IndexRow[]
  articles.ts          # articles/ 走査・本文取得・slug
  markdown.ts          # Markdown → HTML（GFM表対応）
components/
  NarrativeChart.tsx   # 強度の時系列チャート（client）
  ArticleList.tsx      # 記事カード一覧
tests/
  index-parser.test.ts
  articles.test.ts
  markdown.test.ts
  fixtures/INDEX.sample.md
```

責務分離：`index-parser`＝一覧/チャート用メタ、`articles`＝本文I/O、`markdown`＝整形。UIはこれらを消費するだけ。

注：`articles/_experiments/`・`INDEX.md`・`_template.md` はサイトの記事対象から除外する。

---

## Task 0: Next.jsプロジェクトの初期化

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Modify: `.gitignore`

- [ ] **Step 1: スキャフォールド（非対話）**

リポジトリ直下で実行（既存ファイルを消さないよう、空一時ディレクトリで作ってから必要物を移す方が安全だが、ここでは直接最小構成を作る）:

```bash
npm init -y
npm pkg set name="narrative-broadcast-site" private=true type="module"
npm pkg set scripts.dev="next dev" scripts.build="next build" scripts.start="next start" scripts.test="vitest run"
npm install next@latest react@latest react-dom@latest
npm install gray-matter unified remark-parse remark-gfm remark-rehype rehype-stringify recharts
npm install -D typescript @types/react @types/node vitest
```

- [ ] **Step 2: `.gitignore` に追記**

`.gitignore` の末尾へ追加（既存の secrets/OS ブロックは残す）:

```
# next/node
/node_modules
/.next
/out
next-env.d.ts
```

- [ ] **Step 3: `tsconfig.json` 作成**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: `next.config.mjs` 作成**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 5: `vitest.config.ts` 作成**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 6: 最小 `app/layout.tsx`**

```tsx
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'BTCナラティブ分析',
  description: 'Bitcoinのナラティブ（市場参加者の認知・物語）を6時間ごとに構造分析するサイト',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header"><a href="/">BTCナラティブ分析</a> <nav><a href="/archive">アーカイブ</a></nav></header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">※本サイトは情報提供を目的とし、投資助言ではありません。</footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: 仮 `app/page.tsx` と `app/globals.css`**

`app/page.tsx`:
```tsx
export default function Home() {
  return <h1>BTCナラティブ分析（セットアップ確認）</h1>;
}
```
`app/globals.css`:
```css
:root { color-scheme: light dark; }
body { margin: 0; font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; line-height: 1.8; }
.site-main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
.site-header { display: flex; gap: 16px; justify-content: space-between; max-width: 760px; margin: 0 auto; padding: 16px; }
.site-footer { max-width: 760px; margin: 0 auto; padding: 24px 16px; font-size: 12px; opacity: 0.7; }
```

- [ ] **Step 8: ビルド確認**

Run: `npm run build`
Expected: ビルド成功（`/` がプリレンダリングされる）。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Next.jsプロジェクト初期化（最小構成）"
```

---

## Task 1: index-parser（INDEX.md 解析）

**Files:**
- Create: `lib/index-parser.ts`, `tests/index-parser.test.ts`, `tests/fixtures/INDEX.sample.md`

- [ ] **Step 1: フィクスチャ作成 `tests/fixtures/INDEX.sample.md`**

```markdown
# 配信インデックス

| 配信日時(JST) | サイクル | 支配的ナラティブ | 強度(前回比) | 主要データ | ファイル |
|---|---|---|---|---|---|
| 2026-06-06 15:04 | 6h | 言説の空洞化 | 5/10 (−1) | BTC$61.1k・MVRV-Z 0.25 | [link](2026/06/2026-06-06-1504-6h-btc.md) |
| 2026-06-04 23:25 | 6h | risk asset確定 | 7/10 (±0) | BTC$64.1k | [link](2026/06/2026-06-04-6h-btc.md) |
```

- [ ] **Step 2: 失敗するテスト `tests/index-parser.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseIndex } from '../lib/index-parser';

const sample = readFileSync(join(__dirname, 'fixtures/INDEX.sample.md'), 'utf8');

describe('parseIndex', () => {
  it('テーブル行を構造化し、ヘッダ/区切り行を除外する', () => {
    const rows = parseIndex(sample);
    expect(rows).toHaveLength(2);
  });
  it('強度を数値とデルタに分解する', () => {
    const [first] = parseIndex(sample);
    expect(first.strength).toBe(5);
    expect(first.strengthDelta).toBe('−1');
  });
  it('ファイルリンクからslugを抽出する（.md除去）', () => {
    const [first] = parseIndex(sample);
    expect(first.slug).toBe('2026/06/2026-06-06-1504-6h-btc');
    expect(first.datetime).toBe('2026-06-06 15:04');
    expect(first.narrative).toBe('言説の空洞化');
  });
});
```

- [ ] **Step 3: 失敗確認**

Run: `npm run test`
Expected: FAIL（`parseIndex` 未定義）。

- [ ] **Step 4: 実装 `lib/index-parser.ts`**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type IndexRow = {
  datetime: string;
  cycle: string;
  narrative: string;
  strength: number;
  strengthDelta: string;
  keyData: string;
  slug: string;
};

const ARTICLES_DIR = join(process.cwd(), 'articles');

export function parseIndex(markdown: string): IndexRow[] {
  const rows: IndexRow[] = [];
  for (const line of markdown.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 6) continue;
    if (cells[0].startsWith('配信日時')) continue;       // ヘッダ
    if (/^-+$/.test(cells[0].replace(/\s/g, ''))) continue; // 区切り
    const strengthMatch = cells[3].match(/(\d+)\s*\/\s*10\s*\(([^)]*)\)/);
    const linkMatch = cells[5].match(/\(([^)]+)\)/);
    if (!strengthMatch || !linkMatch) continue;
    rows.push({
      datetime: cells[0],
      cycle: cells[1],
      narrative: cells[2],
      strength: Number(strengthMatch[1]),
      strengthDelta: strengthMatch[2].trim(),
      keyData: cells[4],
      slug: linkMatch[1].replace(/\.md$/, ''),
    });
  }
  return rows;
}

export function getIndexRows(): IndexRow[] {
  return parseIndex(readFileSync(join(ARTICLES_DIR, 'INDEX.md'), 'utf8'));
}
```

- [ ] **Step 5: テスト通過確認**

Run: `npm run test`
Expected: PASS（3件）。

- [ ] **Step 6: Commit**

```bash
git add lib/index-parser.ts tests/index-parser.test.ts tests/fixtures/INDEX.sample.md
git commit -m "feat: INDEX.md パーサ（一覧/チャート用メタ）"
```

---

## Task 2: articles（記事I/O）

**Files:**
- Create: `lib/articles.ts`, `tests/articles.test.ts`

- [ ] **Step 1: 失敗するテスト `tests/articles.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getArticleSlugs, getArticleBySlug } from '../lib/articles';

describe('articles', () => {
  it('YYYY/MM配下の*-btc.md記事のslugを返し、INDEX/_template/_experimentsを除外する', () => {
    const slugs = getArticleSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.some((s) => s.includes('_experiments'))).toBe(false);
    expect(slugs.some((s) => s.endsWith('INDEX'))).toBe(false);
    expect(slugs.every((s) => /\d{4}\/\d{2}\/.+-btc$/.test(s))).toBe(true);
  });
  it('slugから本文を取得できる', () => {
    const slug = getArticleSlugs()[0];
    const a = getArticleBySlug(slug);
    expect(a).not.toBeNull();
    expect(a!.raw.length).toBeGreaterThan(0);
    expect(getArticleBySlug('does/not/exist')).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npm run test`
Expected: FAIL（`getArticleSlugs` 未定義）。

- [ ] **Step 3: 実装 `lib/articles.ts`**

```ts
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ARTICLES_DIR = join(process.cwd(), 'articles');

export type Article = { slug: string; raw: string };

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '_experiments') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\d{4}-\d{2}-\d{2}.*-btc\.md$/.test(name)) out.push(full);
  }
  return out;
}

export function getArticleSlugs(): string[] {
  return walk(ARTICLES_DIR).map((f) =>
    relative(ARTICLES_DIR, f).replace(/\\/g, '/').replace(/\.md$/, '')
  );
}

export function getArticleBySlug(slug: string): Article | null {
  const file = join(ARTICLES_DIR, `${slug}.md`);
  if (!existsSync(file)) return null;
  return { slug, raw: readFileSync(file, 'utf8') };
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add lib/articles.ts tests/articles.test.ts
git commit -m "feat: 記事I/O（走査・本文取得・除外フィルタ）"
```

---

## Task 3: markdown（HTML整形・GFM表対応）

**Files:**
- Create: `lib/markdown.ts`, `tests/markdown.test.ts`

- [ ] **Step 1: 失敗するテスト `tests/markdown.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../lib/markdown';

describe('renderMarkdown', () => {
  it('GFMの表を<table>に変換する', async () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    const html = await renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });
  it('見出しと引用を変換する', async () => {
    const html = await renderMarkdown('# 見出し\n\n> 注記');
    expect(html).toContain('<h1>見出し</h1>');
    expect(html).toContain('<blockquote>');
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npm run test`
Expected: FAIL（`renderMarkdown` 未定義）。

- [ ] **Step 3: 実装 `lib/markdown.ts`**

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';

export async function renderMarkdown(raw: string): Promise<string> {
  const { content } = matter(raw); // frontmatter無しでも安全に本文を取り出す
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(content);
  return String(file);
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npm run test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add lib/markdown.ts tests/markdown.test.ts
git commit -m "feat: Markdown→HTML整形（GFM表対応）"
```

---

## Task 4: 記事ページ `/articles/[...slug]`

**Files:**
- Create: `app/articles/[...slug]/page.tsx`

- [ ] **Step 1: 実装**

```tsx
import { getArticleSlugs, getArticleBySlug } from '@/lib/articles';
import { renderMarkdown } from '@/lib/markdown';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug: slug.split('/') }));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug.join('/'));
  if (!article) notFound();
  const html = await renderMarkdown(article.raw);
  return <article className="article" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- [ ] **Step 2: ビルドで静的生成を確認**

Run: `npm run build`
Expected: 各記事スラッグが `generateStaticParams` で生成され、ビルド成功。

- [ ] **Step 3: ローカル目視確認**

Run: `npm run build && npm run start`（別ターミナル）→ ブラウザで `/articles/2026/06/2026-06-04-6h-btc` を開く。
Expected: 計器盤テーブル・見出し・免責が表示される。

- [ ] **Step 4: Commit**

```bash
git add app/articles
git commit -m "feat: 個別記事ページ（SSG）"
```

---

## Task 5: アーカイブページ `/archive`

**Files:**
- Create: `app/archive/page.tsx`, `components/ArticleList.tsx`

- [ ] **Step 1: `components/ArticleList.tsx`**

```tsx
import type { IndexRow } from '@/lib/index-parser';

export function ArticleList({ rows }: { rows: IndexRow[] }) {
  return (
    <ul className="article-list">
      {rows.map((r) => (
        <li key={r.slug} className="article-card">
          <a href={`/articles/${r.slug}`}>
            <span className="meta">{r.datetime}・{r.cycle}・強度 {r.strength}/10（{r.strengthDelta}）</span>
            <span className="narrative">{r.narrative}</span>
            <span className="keydata">{r.keyData}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: `app/archive/page.tsx`**

```tsx
import { getIndexRows } from '@/lib/index-parser';
import { ArticleList } from '@/components/ArticleList';

export default function Archive() {
  const rows = getIndexRows(); // INDEXは新しい順
  return (
    <>
      <h1>アーカイブ</h1>
      <ArticleList rows={rows} />
    </>
  );
}
```

- [ ] **Step 3: ビルド＆目視**

Run: `npm run build`（成功）→ `/archive` に全記事が新しい順で並ぶ。

- [ ] **Step 4: Commit**

```bash
git add app/archive components/ArticleList.tsx
git commit -m "feat: アーカイブ一覧"
```

---

## Task 6: ナラティブ遷移チャート

**Files:**
- Create: `components/NarrativeChart.tsx`

- [ ] **Step 1: 実装（client component）**

```tsx
'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export type ChartPoint = { datetime: string; strength: number; narrative: string };

export function NarrativeChart({ data }: { data: ChartPoint[] }) {
  // 古い順（左→右）に並べ替え
  const series = [...data].reverse();
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
          <XAxis dataKey="datetime" tick={{ fontSize: 10 }} hide={series.length > 12} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => [`強度 ${v}/10`, '']}
            labelFormatter={(l) => l} />
          <Line type="monotone" dataKey="strength" stroke="#e0803a" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: client componentとしてビルド成功。

- [ ] **Step 3: Commit**

```bash
git add components/NarrativeChart.tsx
git commit -m "feat: 強度遷移チャート（Recharts）"
```

---

## Task 7: トップページ `/`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 実装（最新＋チャート＋最近の記事）**

```tsx
import { getIndexRows } from '@/lib/index-parser';
import { ArticleList } from '@/components/ArticleList';
import { NarrativeChart } from '@/components/NarrativeChart';

export default function Home() {
  const rows = getIndexRows();
  const latest = rows[0];
  const chart = rows.map((r) => ({ datetime: r.datetime, strength: r.strength, narrative: r.narrative }));
  const recent = rows.slice(0, 10);
  return (
    <>
      <section className="hero">
        <p className="hero-label">最新の分析</p>
        {latest && (
          <a className="hero-link" href={`/articles/${latest.slug}`}>
            <h1>{latest.narrative}</h1>
            <p className="meta">{latest.datetime}・強度 {latest.strength}/10（{latest.strengthDelta}）</p>
          </a>
        )}
      </section>
      <section className="chart">
        <h2>ナラティブ遷移（強度推移）</h2>
        <NarrativeChart data={chart} />
      </section>
      <section className="recent">
        <h2>最近の記事</h2>
        <ArticleList rows={recent} />
        <p><a href="/archive">すべて見る →</a></p>
      </section>
    </>
  );
}
```

- [ ] **Step 2: ビルド＆目視**

Run: `npm run build && npm run start` → `/` に最新・チャート・最近の記事が出る。
Expected: 成功・表示OK。

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: トップページ（最新＋遷移チャート＋最近の記事）"
```

---

## Task 8: Vercelデプロイ＆自動連携

**Files:**
- Create: （必要なら）`vercel.json`（基本は不要。Next.jsは自動検出）

- [ ] **Step 1: Vercelにプロジェクト接続（ユーザー作業 or CLI）**

選択肢A（ダッシュボード）：vercel.com で「Add New Project」→ GitHubの `KEISUKE-MYPC/narrative-broadcast` をImport → Framework=Next.js 自動検出 → Deploy。
選択肢B（CLI）：`npx vercel link` → `npx vercel --prod`。

- [ ] **Step 2: 自動デプロイの確認**

mainへ任意のpush（次のルーチン公開でも可）→ Vercelダッシュボードで新デプロイが走り、本番URLに最新記事が反映されることを確認。
Expected: push→自動デプロイ→反映。

- [ ] **Step 3: ビルド時のファイル参照確認**

Vercelビルドは `articles/` を含むリポジトリ全体をcloneするため、`getIndexRows`/`getArticleSlugs` がビルド時に解決できる。デプロイ後 `/`・`/archive`・記事ページが表示されることを確認。

- [ ] **Step 4: Commit（vercel.json を作成した場合のみ）**

```bash
git add vercel.json
git commit -m "chore: Vercel設定"
```

---

## 注意・補足

- **ビルド頻度**：ルーチンが6時間ごとにpush＝1日4デプロイ。Vercel Hobby枠で問題なし。
- **デザイン**：本プランは機能優先の素の見た目。完成後に **Impeccable**（shape→craft→typeset/layout/quieter→audit/adapt）で仕上げる（別フェーズ）。
- **`articles/_experiments/` 除外**：`lib/articles.ts` の walk で除外済み。INDEX.md/_template.md も `*-btc.md` 正規表現で自然に除外。
- **push運用**：実装中のコミットは、ルーチンの自動公開と分岐し得る。push前に `git pull --rebase origin main` を挟む（アプリコードと `articles/` は競合しない）。

## Self-Review（spec照合）

- 同一repo＋SSG＝Task0-3,8 ✅／INDEX解析＝Task1 ✅／記事ページ＝Task4 ✅／アーカイブ＝Task5 ✅／遷移チャート＝Task6 ✅／トップ＝Task7 ✅／自動デプロイ＝Task8 ✅／免責・トーン＝layout＋記事本文そのまま ✅／_experiments除外＝Task2 ✅
- v1スコープ外（週次ルーチン・収益化・検索）はプラン外＝spec通り ✅
- 型整合：`IndexRow`（index-parser）をArticleList/Home/Chartで一貫使用。`ChartPoint` はHomeで `IndexRow`→射影。`Article` は articles.ts/記事ページで一貫。プレースホルダ無し。
