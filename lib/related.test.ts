import { describe, it, expect } from 'vitest';
import { selectRelated } from './related';
import type { IndexRow } from './index-parser';

// テスト用 IndexRow 生成（newest-first で渡す前提）
function row(slug: string): IndexRow {
  return { datetime: '2026-06-14 00:00', cycle: '6h', narrative: `n-${slug}`, strength: 5, strengthDelta: '±0', keyData: '', slug };
}
// slug 末尾の接尾辞をカテゴリとみなす差し替え関数（-btc / -sol 等）
const catOf = (s: string) => s.split('-').pop() ?? '';

describe('selectRelated', () => {
  const rows = [row('a-btc'), row('b-btc'), row('c-sol'), row('d-btc'), row('e-sol')];

  it('同カテゴリのみ抽出する（別カテゴリは含まない）', () => {
    const r = selectRelated(rows, 'a-btc', 6, catOf);
    expect(r.every((x) => x.slug.endsWith('-btc'))).toBe(true);
    expect(r.some((x) => x.slug.endsWith('-sol'))).toBe(false);
  });
  it('現記事自身を除外する', () => {
    const r = selectRelated(rows, 'a-btc', 6, catOf);
    expect(r.find((x) => x.slug === 'a-btc')).toBeUndefined();
  });
  it('limit件で打ち切る', () => {
    const r = selectRelated(rows, 'a-btc', 1, catOf);
    expect(r.length).toBe(1);
  });
  it('新しい順（入力順）を保つ', () => {
    const r = selectRelated(rows, 'a-btc', 6, catOf);
    expect(r.map((x) => x.slug)).toEqual(['b-btc', 'd-btc']);
  });
  it('同カテゴリがlimit未満ならある分だけ返す', () => {
    const r = selectRelated(rows, 'c-sol', 6, catOf);
    expect(r.map((x) => x.slug)).toEqual(['e-sol']);
  });
});
