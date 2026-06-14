// 分析の「分野(カテゴリ)」レジストリ。
// 分野はファイル名の接尾辞で表す（例: …-btc.md / 将来 …-eth.md）。
// 新しい分野を足すときは、ここに1件追加し、その接尾辞で記事を置けばよい。

export type Category = {
  slug: string; // ファイル名接尾辞・URLキー（例: 'btc'）
  label: string; // 正式名（例: 'Bitcoin ナラティブ'）
  short: string; // チップ等の短縮表記（例: 'BTC'）
  description: string; // 分野の一言説明
  symbol: string; // アイキャッチのシンボル（例: '₿'）
  accent: string; // 識別用アクセント色（CSS変数 or oklch・サイト内表示用）
  ogAccent: string; // OG画像用の実色（CSS変数は使えないため oklch/hex 実値）
};

export const CATEGORIES: Category[] = [
  {
    slug: 'btc',
    label: 'Bitcoin ナラティブ',
    short: 'BTC',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: '₿',
    accent: 'var(--accent)',
    ogAccent: '#5cc6da', // OG画像用の実色（≒ --accent oklch(0.78 0.10 205)）
  },
  {
    slug: 'eth',
    label: 'Ethereum ナラティブ',
    short: 'ETH',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: 'Ξ',
    accent: 'var(--accent)',
    ogAccent: '#8a92b2',
  },
];

export const DEFAULT_CATEGORY = 'btc';

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

/** slug から分野定義を引く（未登録ならデフォルト分野にフォールバック） */
export function getCategory(slug: string): Category {
  return BY_SLUG.get(slug) ?? BY_SLUG.get(DEFAULT_CATEGORY)!;
}

/**
 * 記事の slug / ファイル名から分野を判定する。
 * 末尾の "-xxx" を見て、登録済み分野ならそれを、無ければデフォルト分野を返す。
 * 例: '2026/06/2026-06-07-0905-6h-btc' → btc
 */
export function categoryFromSlug(slug: string): Category {
  const last = slug.split('/').pop() ?? slug;
  const m = last.match(/-([a-z0-9]+)$/);
  if (m && BY_SLUG.has(m[1])) return BY_SLUG.get(m[1])!;
  return BY_SLUG.get(DEFAULT_CATEGORY)!;
}
