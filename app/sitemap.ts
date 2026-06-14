import type { MetadataRoute } from 'next';
import { getArticleSlugs } from '@/lib/articles';
import { getIndexRows } from '@/lib/index-parser';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';
import { publishedISO } from '@/lib/seo';

const BASE = 'https://narrative-broadcast.com';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = getArticleSlugs();
  // 最新記事の公開日時（同一オフセットのISO文字列は辞書順＝時系列順）。
  // トップ/アーカイブの lastModified に使い、サイト更新の鮮度を伝える。
  const latest = slugs.map(publishedISO).filter(Boolean).sort().at(-1);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: latest, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE}/archive`, lastModified: latest, changeFrequency: 'hourly', priority: 0.8 },
  ];
  // アーカイブ2ページ目以降
  const total = Math.max(1, Math.ceil(getIndexRows().length / ARCHIVE_PER_PAGE));
  const archivePages: MetadataRoute.Sitemap = [];
  for (let p = 2; p <= total; p++) {
    archivePages.push({ url: `${BASE}/archive/${p}`, lastModified: latest, changeFrequency: 'weekly', priority: 0.4 });
  }
  const articles: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/articles/${slug}`,
    lastModified: publishedISO(slug) || undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));
  return [...staticPages, ...archivePages, ...articles];
}
