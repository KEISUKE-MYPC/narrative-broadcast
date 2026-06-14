# 記事下部に関連記事（内部リンク） — 設計書

作成日: 2026-06-14

## 背景・課題

技術SEO土台の整備後、記事ページを監査したところ **記事から他記事への内部リンクが0本**だった
（パンくずのホーム/アーカイブを除く）。内部リンク不在はクロール深度・回遊・リンク評価の面で弱い。

## ゴール

記事ページ下部に「関連する分析」セクションを設け、同カテゴリの最新記事へのリンクを6本張る。
これにより記事間の内部リンクを生成し、クロール深度・回遊・リンク評価を改善する。

決定事項（2026-06-14）:
- 選択ロジックは **同カテゴリの最新（現記事を除く）**。現状は全記事BTCのため実質「最近の記事」だが、
  将来分野が増えたら自動で分野別の関連になる（将来対応）。
- 表示件数は **6件**。
- ラベルは **「関連する分析」**。

## コンポーネント構成

### ① 関連記事の取得 — `lib/related.ts`（新規）

```
getRelatedRows(slug: string, limit = 6): IndexRow[]
```
- `getIndexRows()`（新しい順）から、`categoryFromSlug(row.slug)` が現記事と同カテゴリの行を抽出。
- 現記事自身（`row.slug === slug`）を除外。
- 先頭から `limit` 件を返す。
- 同カテゴリが `limit` 未満ならある分だけ返す（他カテゴリでの穴埋めはしない＝関連性を保つ）。
- 純粋関数に近く、ファイルI/Oは `getIndexRows()` 経由のみ。ロジックはテスト可能。

依存：`getIndexRows`（`lib/index-parser`）、`categoryFromSlug`（`lib/categories`）。
新規ファイルに置くことで循環依存を避ける。

### ② 記事ページに描画 — `app/articles/[...slug]/page.tsx`（変更）

- `getRelatedRows(slugPath)` を呼び、結果を既存の `ArticleList` コンポーネントで描画。
- 配置：メインカラム `article-col` 内、本文 `<article>` の直後。
```tsx
{related.length > 0 && (
  <section className="related-articles">
    <h2 className="section-title"><span className="ja">関連する分析</span></h2>
    <ArticleList rows={related} />
  </section>
)}
```
- `ArticleList` は `rows: IndexRow[]` を受け取りカード（`<a href="/articles/${slug}">`）を描画する既存実装。
  カードグリッドはモバイル対応済み。

### ③ スタイル — `app/globals.css`（変更）

`.related-articles` に上方向の余白と区切り（上ボーダー）を最小限追加。
見出しは既存 `.section-title`、カードは既存 `.card-grid` を流用するため新規スタイルは僅少。

## データフロー

記事ページ（SSG・`generateStaticParams`で全記事生成）
→ `getRelatedRows(slugPath)` で同カテゴリ最新6件を取得
→ `ArticleList` がカードを描画（各カードが `/articles/<slug>` へのリンク）
→ 記事間内部リンクが静的HTMLに出力される。

## エラー処理

- 関連が0件（そのカテゴリに現記事しか無い場合）はセクションごと非表示（`related.length > 0` ガード）。

## テスト

`lib/related.test.ts`（Vitest）:
- 同カテゴリのみ抽出する（別カテゴリのslugは含まれない）。
- 現記事自身を除外する。
- `limit` 件で打ち切る。
- 新しい順（`getIndexRows` の順）を保つ。
- 同カテゴリが `limit` 未満ならある分だけ返す。

テスト用に `getIndexRows` をモックするか、カテゴリ判定が効く実スラッグ配列を使う。
`getRelatedRows` 内部ロジック（フィルタ・除外・slice）を検証する。

## 検証方法

1. `npm test` 全パス、`npx tsc --noEmit` clean、`npm run build` 成功。
2. ビルド済み記事HTMLに `/articles/` への内部リンクが6本出力されることを確認
   （`grep -o 'href="/articles/' | wc -l` が増える）。
3. デプロイ後、記事ページ下部に「関連する分析」カードが6枚表示され、各カードから他記事へ遷移できることを確認。
4. モバイル幅で横はみ出しが無いこと（既存 `.card-grid` 流用のため担保される）。

## スコープ外

カテゴリページ（`/c/<slug>`・フェーズ2）、人気記事ランキング、サイドバー設置、
関連度スコアリング（タグ/本文類似度など）。
