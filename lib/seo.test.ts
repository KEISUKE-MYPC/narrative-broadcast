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
