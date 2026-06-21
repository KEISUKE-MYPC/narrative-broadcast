import { describe, it, expect } from 'vitest';
import { stampFromSlug, articleUrl, topicHubUrl, domainHubUrl } from './urls';

describe('urls', () => {
  it('stampFromSlug は先頭のタイムスタンプを返す', () => {
    expect(stampFromSlug('2026/06/2026-06-20-1258-6h-btc')).toBe('2026-06-20-1258');
  });
  it('articleUrl は /{domain}/{topic}/{stamp}', () => {
    expect(articleUrl('2026/06/2026-06-20-1258-6h-btc')).toBe('/crypto/btc/2026-06-20-1258');
    expect(articleUrl('2026/06/2026-06-20-1258-7d-weekly')).toBe('/crypto/weekly/2026-06-20-1258');
  });
  it('topicHubUrl はページ有無で分岐', () => {
    expect(topicHubUrl('btc')).toBe('/crypto/btc');
    expect(topicHubUrl('btc', 1)).toBe('/crypto/btc');
    expect(topicHubUrl('btc', 2)).toBe('/crypto/btc/page/2');
  });
  it('domainHubUrl は /{domain}', () => {
    expect(domainHubUrl('crypto')).toBe('/crypto');
  });
});
