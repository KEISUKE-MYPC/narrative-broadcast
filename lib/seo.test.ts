import { describe, it, expect } from 'vitest';
import { publishedISO, absoluteUrl, SITE_URL } from './seo';

describe('publishedISO', () => {
  it('スラッグ末尾の YYYY-MM-DD-HHMM を JST ISO に変換する', () => {
    expect(publishedISO('2026/06/2026-06-14-0047-6h-btc')).toBe('2026-06-14T00:47:00+09:00');
  });
  it('時刻が無ければ日付のみ(00:00 JST)にフォールバック', () => {
    expect(publishedISO('2026/06/2026-06-14-btc')).toBe('2026-06-14T00:00:00+09:00');
  });
  it('日付が全く無ければ空文字', () => {
    expect(publishedISO('foo/bar')).toBe('');
  });
});

describe('absoluteUrl', () => {
  it('SITE_URL とパスを連結する', () => {
    expect(absoluteUrl('/og/btc')).toBe(`${SITE_URL}/og/btc`);
  });
});

import {
  websiteJsonLd, organizationJsonLd, articleJsonLd, breadcrumbJsonLd, SITE_NAME,
} from './seo';

describe('JSON-LD builders', () => {
  it('websiteJsonLd は WebSite 型', () => {
    const o = websiteJsonLd() as Record<string, unknown>;
    expect(o['@type']).toBe('WebSite');
    expect(o.name).toBe(SITE_NAME);
    expect(o.inLanguage).toBe('ja');
  });
  it('organizationJsonLd は Organization 型でlogoが絶対URL', () => {
    const o = organizationJsonLd() as Record<string, unknown>;
    expect(o['@type']).toBe('Organization');
    expect(String(o.logo).startsWith('https://')).toBe(true);
  });
  it('articleJsonLd は必須フィールドを持つ', () => {
    const o = articleJsonLd({
      slug: '2026/06/2026-06-14-0047-6h-btc', title: 'T', description: 'D', image: '/og/btc',
    }) as Record<string, unknown>;
    expect(o['@type']).toBe('Article');
    expect(o.headline).toBe('T');
    expect(o.description).toBe('D');
    expect(o.datePublished).toBe('2026-06-14T00:47:00+09:00');
    expect(o.dateModified).toBe('2026-06-14T00:47:00+09:00');
    expect(String(o.image)).toBe('https://narrative-broadcast.com/og/btc');
    expect((o.publisher as Record<string, unknown>)['@type']).toBe('Organization');
  });
  it('breadcrumbJsonLd は3階層', () => {
    const o = breadcrumbJsonLd({ slug: '2026/06/2026-06-14-0047-6h-btc', categoryShort: 'BTC' }) as Record<string, unknown>;
    expect(o['@type']).toBe('BreadcrumbList');
    const items = o.itemListElement as unknown[];
    expect(items.length).toBe(3);
  });
});
