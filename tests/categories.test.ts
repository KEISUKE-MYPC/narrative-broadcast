import { describe, it, expect } from 'vitest';
import { categoryFromSlug, getCategory, DEFAULT_CATEGORY } from '../lib/categories';

describe('categoryFromSlug', () => {
  it('ファイル名末尾の接尾辞から分野を判定する', () => {
    expect(categoryFromSlug('2026/06/2026-06-07-0905-6h-btc').slug).toBe('btc');
  });
  it('未登録の接尾辞はデフォルト分野へフォールバックする', () => {
    expect(categoryFromSlug('2026/06/2026-06-07-foo-xyz').slug).toBe(DEFAULT_CATEGORY);
  });
});

describe('getCategory', () => {
  it('未登録slugはデフォルト分野を返す', () => {
    expect(getCategory('does-not-exist').slug).toBe(DEFAULT_CATEGORY);
  });
});
