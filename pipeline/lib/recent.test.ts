import { describe, it, expect } from 'vitest';
import { recentNarratives } from './recent';
import type { IndexRow } from '../../lib/index-parser';

const rows: IndexRow[] = Array.from({ length: 8 }, (_, i) => ({
  datetime: `d${i}`, cycle: '6h', narrative: `n${i}`, strength: 1,
  strengthDelta: '±0', keyData: 'k', slug: `s${i}`,
}));

describe('recentNarratives', () => {
  it('returns first N narratives', () => {
    expect(recentNarratives(rows, 5)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
  });
});
