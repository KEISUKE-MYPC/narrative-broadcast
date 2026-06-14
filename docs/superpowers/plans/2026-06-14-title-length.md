# タイトル長の是正（ハイブリッド） 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検索結果に収まる見出し/`<title>` を実現する。パイプラインで未来の見出しを全角40字以内に根治し、サイト側で既存記事の `<title>`/og/JSON-LD headline を短縮（遡及）する。

**Architecture:** 純粋関数 `shortTitle(narrative, max=40)` を `lib/title.ts` に新設。記事ページの `generateMetadata`（title/og/twitter）と `articleJsonLd` の headline 引数に適用。`pipeline/build-prompt.ts` のプロンプトに「全角40字以内」を明記。オンページH1・カード見出し・INDEXは不変。

**Tech Stack:** Next.js App Router (SSG), TypeScript, Vitest

---

## ファイル構成

- Create: `lib/title.ts` — `shortTitle(narrative, max)` 純粋関数
- Create: `lib/title.test.ts` — `shortTitle` のテスト
- Modify: `app/articles/[...slug]/page.tsx` — title/og/twitter と articleJsonLd headline に `shortTitle` 適用
- Modify: `pipeline/build-prompt.ts` — 見出し指示に「全角40字以内」を明記（2箇所）

参照する既存シグネチャ：
- `app/articles/[...slug]/page.tsx`: `generateMetadata` 内 `const title = row?.narrative ?? 'ナラティブ分析'`。本体で `articleJsonLd({ slug, title: row?.narrative ?? 'ナラティブ分析', description, image })`。
- `pipeline/build-prompt.ts`: `GUARDRAILS` の項目6「6. タイトルは支配ナラティブを1行で。…」、出力形式の `# タイトル（支配ナラティブを1行・煽らない）`。

---

### Task 1: `lib/title.ts` — shortTitle 純粋関数

**Files:**
- Create: `lib/title.ts`
- Create: `lib/title.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/title.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shortTitle } from './title';

describe('shortTitle', () => {
  it('max字以内はそのまま返す（…を付けない）', () => {
    const s = 'あ'.repeat(40);
    expect(shortTitle(s, 40)).toBe(s);
  });
  it('ちょうどmax字はそのまま', () => {
    const s = 'い'.repeat(40);
    expect(shortTitle(s, 40)).toBe(s);
    expect(shortTitle(s, 40).endsWith('…')).toBe(false);
  });
  it('max字以内に区切りがあればそこで切り…を付ける', () => {
    const s = 'あ'.repeat(30) + '、' + 'い'.repeat(20); // 区切りは index 30
    expect(shortTitle(s, 40)).toBe('あ'.repeat(30) + '…');
  });
  it('区切りが無い長文はmax字でハード切り＋…（長さ max+1）', () => {
    const s = 'あ'.repeat(50);
    const r = shortTitle(s, 40);
    expect(r).toBe('あ'.repeat(40) + '…');
    expect(r.length).toBe(41);
  });
  it('区切りが前すぎる場合はハード切り（極端に短いタイトルを避ける）', () => {
    const s = 'あ、' + 'い'.repeat(50); // 区切りは index 1（max*0.6=24未満）
    expect(shortTitle(s, 40)).toBe(('あ、' + 'い'.repeat(50)).slice(0, 40) + '…');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/title.test.ts`
Expected: FAIL（`./title` が存在しない）

- [ ] **Step 3: 最小実装を書く**

`lib/title.ts`:
```ts
// 見出し（narrative）を <title>/og 用に短縮する純粋関数。
// max字以内ならそのまま。超える場合は max字以内の最後の自然な区切りで切り、
// 適切な区切りが無ければ max字でハード切りし、いずれも末尾に … を付す。
const BREAKS = ['。', '、', '／', '・', '―', '：'];

export function shortTitle(narrative: string, max = 40): string {
  const s = narrative.trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  let cut = -1;
  for (const b of BREAKS) {
    const i = head.lastIndexOf(b);
    if (i > cut) cut = i;
  }
  // 区切りが後方(max*0.6以降)にある時だけ採用し、極端に短いタイトルを避ける
  if (cut >= Math.floor(max * 0.6)) return head.slice(0, cut) + '…';
  return head + '…';
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/title.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: コミット**

```bash
git add lib/title.ts lib/title.test.ts
git commit -m "feat(seo): 見出しを<title>用に短縮するshortTitleを追加"
```

---

### Task 2: 記事ページのメタ/JSON-LD に shortTitle を適用

**Files:**
- Modify: `app/articles/[...slug]/page.tsx`

> 現状 `generateMetadata` 内に `const title = row?.narrative ?? 'ナラティブ分析'` があり、それを title/openGraph/twitter に使用。本体では `articleJsonLd({ ..., title: row?.narrative ?? 'ナラティブ分析', ... })`。

- [ ] **Step 1: import を追加**

既存 import 群に追加:
```tsx
import { shortTitle } from '@/lib/title';
```

- [ ] **Step 2: generateMetadata の title を短縮版にする**

`generateMetadata` 内の
```tsx
  const title = row?.narrative ?? 'ナラティブ分析';
```
を
```tsx
  const title = shortTitle(row?.narrative ?? 'ナラティブ分析');
```
に変更する（この `title` が title / openGraph.title / twitter.title に渡るため一括で短縮される）。

- [ ] **Step 3: articleJsonLd の headline を短縮版にする**

本体（ArticlePage）の `seoData` 構築箇所の
```tsx
    articleJsonLd({ slug: slugPath, title: row?.narrative ?? 'ナラティブ分析', description, image: ogImage }),
```
を
```tsx
    articleJsonLd({ slug: slugPath, title: shortTitle(row?.narrative ?? 'ナラティブ分析'), description, image: ogImage }),
```
に変更する。

> 注: ブレッドクラム表示やオンページH1（`html` 由来）は変更しない。`breadcrumbJsonLd` は categoryShort を使うため変更不要。

- [ ] **Step 4: 型チェックとビルド**

Run: `npx tsc --noEmit` — エラーなし
Run: `npm run build` — 成功。失敗時は BLOCKED で報告。

- [ ] **Step 5: <title> が短縮されたか確認**

Run（長いnarrativeの記事のHTMLを調べる）:
```bash
htmlfile=$(find .next/server/app/articles -name "*.html" | head -1)
grep -o '<title>[^<]*</title>' "$htmlfile"
```
Expected: `<title>` の見出し部分が約40字以内＋`…`＋`| Narrative Broadcast` 形式（元の数百字ではない）。

- [ ] **Step 6: コミット**

```bash
git add "app/articles/[...slug]/page.tsx"
git commit -m "feat(seo): 記事の<title>/og/JSON-LD headlineをshortTitleで短縮"
```

---

### Task 3: パイプラインのプロンプトに見出し上限を明記

**Files:**
- Modify: `pipeline/build-prompt.ts`

- [ ] **Step 1: GUARDRAILS 項目6 を更新**

`pipeline/build-prompt.ts` の
```ts
6. タイトルは支配ナラティブを1行で。「〜号」「今号」「速報」等の自己言及・体裁語で締めない。
```
を
```ts
6. タイトルは支配ナラティブを全角40字以内で（詳細な論証は本文に書く）。「〜号」「今号」「速報」等の自己言及・体裁語で締めない。
```
に変更する。

- [ ] **Step 2: 出力形式の注記を更新**

同ファイルの
```ts
- \`# タイトル\`（支配ナラティブを1行・煽らない）
```
を
```ts
- \`# タイトル\`（支配ナラティブを全角40字以内・煽らない）
```
に変更する。

- [ ] **Step 3: 既存テストが壊れないことを確認**

Run: `npx vitest run pipeline/build-prompt.test.ts`
Expected: PASS（テストはタイトル文言をassertしていないため影響なし）。

- [ ] **Step 4: コミット**

```bash
git add pipeline/build-prompt.ts
git commit -m "feat(pipeline): 生成見出しを全角40字以内に制約（タイトル長の根治）"
```

---

### Task 4: 全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト**

Run: `npx vitest run`
Expected: 全テストPASS（既存53 ＋ 新規5 = 58）。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: 本番ビルド**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 4: <title> 短縮の確認（複数記事）**

Run:
```bash
for f in $(find .next/server/app/articles -name "*.html" | head -3); do
  t=$(grep -o '<title>[^<]*</title>' "$f")
  echo "len=$(echo -n "$t" | wc -m) $t" | head -c 160; echo ""
done
```
Expected: 各 `<title>` の見出し部が約40字台＋`| Narrative Broadcast`（数百字ではない）。

- [ ] **Step 5: JSON-LD headline 短縮の確認**

Run:
```bash
htmlfile=$(find .next/server/app/articles -name "*.html" | head -1)
grep -o '"headline":"[^"]*"' "$htmlfile" | head -1
```
Expected: headline が短縮版（約40字＋`…`）。

- [ ] **Step 6: push（ユーザー許可後）**

```bash
git push origin main
```

- [ ] **Step 7: デプロイ後の本番確認**

- 長文narrativeの既存記事で `<title>` が短縮されている（例：1013字記事）。
- オンページのH1は従来どおり（変化なし）。
- （任意・後日）プロンプト変更後の次回自動公開記事で生成H1が40字前後に収まる。

---

## Self-Review メモ

- **Spec coverage:** ①パイプラインプロンプト=Task3、②`shortTitle`=Task1、②適用（title/og/twitter/JSON-LD headline）=Task2、テスト=Task1＋Task4、検証=Task4。全項目に対応タスクあり。オンページH1/カード/INDEX不変もTask2注記で担保。
- **型整合:** `shortTitle(narrative, max=40)` のシグネチャはTask1定義とTask2呼び出しで一致。`articleJsonLd` の `title` 引数に短縮版を渡すだけで `lib/seo.ts` は変更不要。
- **Placeholder:** なし。プロンプト変更は前後の文字列を実値で明示。
- **テスト境界:** `max*0.6` ガードを「区切りが前すぎる」ケースのテストで明示的に検証。ハード切りは長さ `max+1` を検証。
