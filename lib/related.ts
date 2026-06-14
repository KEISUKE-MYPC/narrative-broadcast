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
// 「最新」は getIndexRows() が新しい順（INDEX.md生成側の契約）であることに依存する。
export function getRelatedRows(slug: string, limit = 6): IndexRow[] {
  return selectRelated(getIndexRows(), slug, limit);
}
