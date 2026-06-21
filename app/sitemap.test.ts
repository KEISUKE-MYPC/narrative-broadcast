import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('新URL形（/crypto/...）を含み、旧形（/c/・/articles/）を含まない', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain('https://narrative-broadcast.com/crypto');
    expect(urls).toContain('https://narrative-broadcast.com/crypto/btc');
    expect(urls.some((u) => /\/crypto\/(btc|weekly)\/\d{4}-\d{2}-\d{2}-\d{4}$/.test(u))).toBe(true);
    expect(urls.some((u) => u.includes('/c/'))).toBe(false);
    expect(urls.some((u) => u.includes('/articles/'))).toBe(false);
  });
});
