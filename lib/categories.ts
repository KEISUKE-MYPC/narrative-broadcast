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
  brand: string; // 各トークンのブランド色（チャート線・タブ用の実hex）
  brandGradient?: [string, string]; // 線をグラデにする場合の[開始,終了]（例: SOLの紫→緑）
  metaCategory?: boolean; // 横断メタカテゴリ（銘柄別強度チャートから除外する）
  domain: string; // 所属ドメイン（例: 'crypto'）
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
    brand: '#F7931A', // Bitcoinブランドのオレンジ
    domain: 'crypto',
  },
  {
    slug: 'eth',
    label: 'Ethereum ナラティブ',
    short: 'ETH',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: 'Ξ',
    accent: 'var(--accent)',
    ogAccent: '#8a92b2',
    brand: '#627EEA', // Ethereumブランドのペリウィンクル
    domain: 'crypto',
  },
  {
    slug: 'xrp',
    label: 'XRP ナラティブ',
    short: 'XRP',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: '✕',
    accent: 'var(--accent)',
    ogAccent: '#7e8a99',
    brand: '#CFD6DD', // XRPは公式が黒/白のためダーク背景で映えるシルバー
    domain: 'crypto',
  },
  {
    slug: 'sol',
    label: 'Solana ナラティブ',
    short: 'SOL',
    description: '市場参加者の物語と認知を6時間ごとに構造分析',
    symbol: '◎',
    accent: 'var(--accent)',
    ogAccent: '#66f9a1',
    brand: '#14F195', // Solanaグラデの代表色（タブ・ドット用）
    brandGradient: ['#9945FF', '#14F195'], // 公式グラデ 紫→緑（線用）
    domain: 'crypto',
  },
  {
    slug: 'weekly',
    label: '週次メタナラティブ',
    short: '週次',
    description: '市場全体の語りを横断的に統合する週次レポート',
    symbol: '◴',
    accent: 'var(--accent)',
    ogAccent: '#d9a441', // 横断レポート用のアンバー
    brand: '#E0B341', // フィード/タブ用のアンバー実hex
    metaCategory: true,
    domain: 'crypto',
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
