import { describe, it, expect } from 'vitest';
import { legacyRedirect } from './redirects';

describe('legacyRedirect', () => {
  it('旧記事URL → 新記事URL', () => {
    expect(legacyRedirect('/articles/2026/06/2026-06-20-1258-6h-btc'))
      .toBe('/crypto/btc/2026-06-20-1258');
    expect(legacyRedirect('/articles/2026/06/2026-06-20-1258-7d-weekly'))
      .toBe('/crypto/weekly/2026-06-20-1258');
  });
  it('旧カテゴリハブ → 新トピックハブ', () => {
    expect(legacyRedirect('/c/btc')).toBe('/crypto/btc');
    expect(legacyRedirect('/c/btc/')).toBe('/crypto/btc');
  });
  it('旧カテゴリページング → 新ページング', () => {
    expect(legacyRedirect('/c/btc/2')).toBe('/crypto/btc/page/2');
  });
  it('対象外は null', () => {
    expect(legacyRedirect('/')).toBeNull();
    expect(legacyRedirect('/archive')).toBeNull();
    expect(legacyRedirect('/crypto/btc/2026-06-20-1258')).toBeNull();
  });
});
