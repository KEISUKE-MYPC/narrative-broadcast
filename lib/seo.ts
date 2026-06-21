import { articleUrl } from './urls';

export const SITE_URL = 'https://narrative-broadcast.com';
export const SITE_NAME = 'Narrative Broadcast';
export const SITE_DESCRIPTION = '市場参加者の物語と認知を構造分析するナラティブ観測メディア';

export function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path}`;
}

// スラッグ末尾の日時から JST(+09:00) の ISO8601 を生成する
export function publishedISO(slug: string): string {
  const last = slug.split('/').pop() ?? slug;
  const dt = last.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/);
  if (dt) {
    const [, y, mo, d, h, mi] = dt;
    return `${y}-${mo}-${d}T${h}:${mi}:00+09:00`;
  }
  const dOnly = last.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dOnly) {
    const [, y, mo, d] = dOnly;
    return `${y}-${mo}-${d}T00:00:00+09:00`;
  }
  return '';
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'ja',
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/icon'),
  };
}

export function articleJsonLd(args: {
  slug: string; title: string; description: string; image: string;
}) {
  const url = absoluteUrl(articleUrl(args.slug));
  const published = publishedISO(args.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.title,
    description: args.description,
    image: absoluteUrl(args.image),
    datePublished: published,
    dateModified: published,
    inLanguage: 'ja',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon') },
    },
  };
}

export function breadcrumbJsonLd(args: { slug: string; categoryShort: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'アーカイブ', item: absoluteUrl('/archive') },
      { '@type': 'ListItem', position: 3, name: args.categoryShort, item: absoluteUrl(articleUrl(args.slug)) },
    ],
  };
}
