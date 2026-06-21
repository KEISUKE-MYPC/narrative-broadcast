import { describe, it, expect } from 'vitest';
import { findSlugByStampTopic } from './articles';

const SLUGS = [
  '2026/06/2026-06-20-1258-6h-btc',
  '2026/06/2026-06-20-1258-7d-weekly',
  '2026/06/2026-06-19-1800-6h-eth',
];

describe('findSlugByStampTopic', () => {
  it('stamp と topic に一致する slug を返す', () => {
    expect(findSlugByStampTopic(SLUGS, '2026-06-20-1258', 'btc')).toBe('2026/06/2026-06-20-1258-6h-btc');
    expect(findSlugByStampTopic(SLUGS, '2026-06-20-1258', 'weekly')).toBe('2026/06/2026-06-20-1258-7d-weekly');
  });
  it('一致が無ければ null', () => {
    expect(findSlugByStampTopic(SLUGS, '2026-06-20-1258', 'sol')).toBeNull();
    expect(findSlugByStampTopic(SLUGS, '2099-01-01-0000', 'btc')).toBeNull();
  });
});
