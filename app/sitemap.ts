import type { MetadataRoute } from 'next';
import { getArticleSlugs } from '@/lib/articles';

const BASE = 'https://narrative-broadcast.com';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE}/archive`, changeFrequency: 'hourly', priority: 0.8 },
  ];
  const articles: MetadataRoute.Sitemap = getArticleSlugs().map((slug) => ({
    url: `${BASE}/articles/${slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));
  return [...staticPages, ...articles];
}
