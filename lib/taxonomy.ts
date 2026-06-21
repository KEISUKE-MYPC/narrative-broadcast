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
