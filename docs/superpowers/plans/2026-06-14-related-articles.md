# 記事下部に関連記事（内部リンク） 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 記事ページ下部に「関連する分析」セクション（同カテゴリ最新6件）を設け、記事間の内部リンクを生成する。

**Architecture:** 純粋関数 `selectRelated(rows, slug, limit, categoryOf)` ＋ I/Oラッパー `getRelatedRows(slug, limit)` を `lib/related.ts` に新設（`excerpt.ts` と同じ pure/IO 分離パターン）。記事ページが `getRelatedRows` を呼び、既存 `ArticleList` でカード描画。スタイルは既存 `.section-title`/`.card-grid` を流用し `.related-articles` を僅少追加。

**Tech Stack:** Next.js App Router (SSG), TypeScript, Vitest

---

## ファイル構成

- Create: `lib/related.ts` — `selectRelated`（純粋）＋ `getRelatedRows`（I/O）
- Create: `lib/related.test.ts` — `selectRelated` のテスト
- Modify: `app/articles/[...slug]/page.tsx` — 関連記事セクションを描画
- Modify: `app/globals.css` — `.related-articles` の余白/区切り

参照する既存シグネチャ：
- `lib/index-parser.ts`: `type IndexRow = { datetime; cycle; narrative; strength; strengthDelta; keyData; slug }` / `getIndexRows(): IndexRow[]`（新しい順）
- `lib/categories.ts`: `categoryFromSlug(slug): Category`（`.slug` を使用。未登録接尾辞は `btc` にフォールバック）
- `components/ArticleList.tsx`: `ArticleList({ rows }: { rows: IndexRow[] })`

---

### Task 1: `lib/related.ts` — 関連記事の選択ロジック

**Files:**
- Create: `lib/related.ts`
- Create: `lib/related.test.ts`

> 注: `getRelatedRows` は `getIndexRows()`（I/O）に依存するため、選択ロジックを純粋関数 `selectRelated` に分離してテストする。カテゴリ判定は第4引数 `categoryOf` で差し替え可能にし、複数カテゴリのフィルタを実テストできるようにする（既定は `categoryFromSlug`）。

- [ ] **Step 1: 失敗するテストを書く**

`lib/related.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { selectRelated } from './related';
import type { IndexRow } from './index-parser';

// テスト用 IndexRow 生成（newest-first で渡す前提）
function row(slug: string): IndexRow {
  return { datetime: '2026-06-14 00:00', cycle: '6h', narrative: `n-${slug}`, strength: 5, strengthDelta: '±0', keyData: '', slug };
}
// slug 末尾の接尾辞をカテゴリとみなす差し替え関数（-btc / -sol 等）
const catOf = (s: string) => s.split('-').pop() ?? '';

describe('selectRelated', () => {
  const rows = [row('a-btc'), row('b-btc'), row('c-sol'), row('d-btc'), row('e-sol')];

  it('同カテゴリのみ抽出する（別カテゴリは含まない）', () => {
    const r = selectRelated(rows, 'a-btc', 6, catOf);
    expect(r.every((x) => x.slug.endsWith('-btc'))).toBe(true);
    expect(r.some((x) => x.slug.endsWith('-sol'))).toBe(false);
  });
  it('現記事自身を除外する', () => {
    const r = selectRelated(rows, 'a-btc', 6, catOf);
    expect(r.find((x) => x.slug === 'a-btc')).toBeUndefined();
  });
  it('limit件で打ち切る', () => {
    const r = selectRelated(rows, 'a-btc', 1, catOf);
    expect(r.length).toBe(1);
  });
  it('新しい順（入力順）を保つ', () => {
    const r = selectRelated(rows, 'a-btc', 6, catOf);
    expect(r.map((x) => x.slug)).toEqual(['b-btc', 'd-btc']);
  });
  it('同カテゴリがlimit未満ならある分だけ返す', () => {
    const r = selectRelated(rows, 'c-sol', 6, catOf);
    expect(r.map((x) => x.slug)).toEqual(['e-sol']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/related.test.ts`
Expected: FAIL（`./related` が存在しない）

- [ ] **Step 3: 最小実装を書く**

`lib/related.ts`:
```ts
import { getIndexRows, type IndexRow } from './index-parser';
import { categoryFromSlug } from './categories';

// rows（新しい順）から、slug と同カテゴリの行を現記事を除いて limit 件選ぶ純粋関数。
// categoryOf を差し替えればテストで複数カテゴリを再現できる。
export function selectRelated(
  rows: IndexRow[],
  slug: string,
  limit = 6,
  categoryOf: (s: string) => string = (s) => categoryFromSlug(s).slug,
): IndexRow[] {
  const cat = categoryOf(slug);
  return rows
    .filter((r) => r.slug !== slug && categoryOf(r.slug) === cat)
    .slice(0, limit);
}

// slug の関連記事（同カテゴリ最新 limit 件）を返す。
export function getRelatedRows(slug: string, limit = 6): IndexRow[] {
  return selectRelated(getIndexRows(), slug, limit);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/related.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: コミット**

```bash
git add lib/related.ts lib/related.test.ts
git commit -m "feat(seo): 関連記事の選択ロジック(selectRelated/getRelatedRows)を追加"
```

---

### Task 2: 記事ページに関連記事セクションを描画

**Files:**
- Modify: `app/articles/[...slug]/page.tsx`

> 現状のファイルは SEO 対応済み。`return (<> <JsonLd .../> <div className="container article-layout"> ... </div> </>)` という構造で、`article-col` の中に crumbs / Eyecatch / `<article>` がある。

- [ ] **Step 1: import を追加**

既存 import 群に追加:
```tsx
import { ArticleList } from '@/components/ArticleList';
import { getRelatedRows } from '@/lib/related';
```

- [ ] **Step 2: 関連記事を取得**

`ArticlePage` 内、`seoData` を組み立てている付近（`const seoData = [...]` の後）に追加:
```tsx
  const related = getRelatedRows(slugPath);
```

- [ ] **Step 3: 本文の直後にセクションを描画**

`article-col` 内の `<article className="article" ... />` の直後（`</div>`（article-col 閉じ）の直前）に追加:
```tsx
        {related.length > 0 && (
          <section className="related-articles">
            <h2 className="section-title">
              <span className="ja">関連する分析</span>
            </h2>
            <ArticleList rows={related} />
          </section>
        )}
```

- [ ] **Step 4: 型チェックとビルド**

Run: `npx tsc --noEmit` — エラーなし
Run: `npm run build` — 成功（記事ページ生成）。失敗時は BLOCKED で報告。

- [ ] **Step 5: 内部リンクが増えたか確認**

Run:
```bash
htmlfile=$(find .next/server/app/articles -name "*.html" | head -1)
grep -o 'href="/articles/' "$htmlfile" | wc -l
```
Expected: 6 以上（関連カード6枚分のリンク）。

- [ ] **Step 6: コミット**

```bash
git add "app/articles/[...slug]/page.tsx"
git commit -m "feat(seo): 記事下部に関連する分析セクション(内部リンク)を追加"
```

---

### Task 3: `.related-articles` のスタイル

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: スタイルを追記**

`app/globals.css` の末尾に追記（既存トークン/変数に倣う。色は既存の境界線変数があればそれを使い、無ければ下記のCSS変数 `--hairline` 等が無い場合は `rgba(255,255,255,0.08)` 相当の既存値に合わせる）:
```css
/* 記事下部の関連記事 */
.related-articles {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}
```

> 注: 既存 `globals.css` に境界線用のCSS変数（例 `--border` / `--hairline` / `--line`）があればそれを使う。実装時に `grep -nE "border|hairline|line" app/globals.css | grep -- "--"` で確認し、適切な既存変数に合わせること。無ければ上記フォールバック値で可。

- [ ] **Step 2: ビルドで確認**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: コミット**

```bash
git add app/globals.css
git commit -m "style(seo): 関連する分析セクションの余白と区切り線を追加"
```

---

### Task 4: 全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト**

Run: `npx vitest run`
Expected: 全テストPASS（既存48 ＋ 新規5 = 53）。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: 本番ビルド**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 4: 内部リンク数の確認**

Run:
```bash
htmlfile=$(find .next/server/app/articles -name "*.html" | head -1)
echo "記事内 /articles リンク数: $(grep -o 'href=\"/articles/' "$htmlfile" | wc -l)"
```
Expected: 6 以上。

- [ ] **Step 5: push（ユーザー許可後）**

```bash
git push origin main
```

- [ ] **Step 6: デプロイ後の本番確認**

- 記事ページ下部に「関連する分析」カードが6枚表示される。
- 各カードから他記事（`/articles/...`）へ遷移できる。
- モバイル幅で横はみ出しが無い（既存 `.card-grid` 流用で担保）。

---

## Self-Review メモ

- **Spec coverage:** ①取得ロジック=Task1、②記事ページ描画=Task2、③スタイル=Task3、テスト=Task1＋Task4、検証=Task4。全項目に対応タスクあり。
- **型整合:** `IndexRow` は `index-parser` の型を再利用。`selectRelated` の引数（rows/slug/limit/categoryOf）はTask1定義とTask3テスト・Task2の `getRelatedRows` 呼び出しで一致。`ArticleList` は `rows` prop。
- **Placeholder:** なし。CSS変数名のみ実装時に既存値へ合わせる指示を明記（曖昧なTBDではなく確認手順を提示）。
- **テスト可能性:** カテゴリ判定を `categoryOf` 引数で差し替えることで、全記事BTCの現状でも複数カテゴリのフィルタを実テストできる。
