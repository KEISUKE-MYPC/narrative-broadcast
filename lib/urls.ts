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
