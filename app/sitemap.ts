import type { MetadataRoute } from 'next';
import { getArticleSlugs } from '@/lib/articles';
import { getIndexRows } from '@/lib/index-parser';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';

const BASE = 'https://narrative-broadcast.com';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE}/archive`, changeFrequency: 'hourly', priority: 0.8 },
  ];
  // アーカイブ2ページ目以降
  const total = Math.max(1, Math.ceil(getIndexRows().length / ARCHIVE_PER_PAGE));
  const archivePages: MetadataRoute.Sitemap = [];
  for (let p = 2; p <= total; p++) {
    archivePages.push({ url: `${BASE}/archive/${p}`, changeFrequency: 'weekly', priority: 0.4 });
  }
  const articles: MetadataRoute.Sitemap = getArticleSlugs().map((slug) => ({
    url: `${BASE}/articles/${slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));
  return [...staticPages, ...archivePages, ...articles];
}
