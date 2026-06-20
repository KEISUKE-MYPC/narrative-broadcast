import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryFromSlug, getCategory } from './categories';

describe('weekly カテゴリ', () => {
  it('weekly が登録され metaCategory フラグを持つ', () => {
    const weekly = CATEGORIES.find((c) => c.slug === 'weekly');
    expect(weekly).toBeTruthy();
    expect(weekly!.metaCategory).toBe(true);
    expect(weekly!.short).toBe('週次');
  });

  it('-7d-weekly 接尾辞の slug を weekly に解決する', () => {
    expect(categoryFromSlug('2026/06/2026-06-21-2100-7d-weekly').slug).toBe('weekly');
  });

  it('getCategory("weekly") が weekly を返す', () => {
    expect(getCategory('weekly').slug).toBe('weekly');
  });
});
