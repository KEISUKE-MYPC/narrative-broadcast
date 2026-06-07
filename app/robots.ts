import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://narrative-broadcast.com/sitemap.xml',
    host: 'https://narrative-broadcast.com',
  };
}
