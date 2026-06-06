import { describe, it, expect } from 'vitest';
import { getArticleSlugs, getArticleBySlug } from '../lib/articles';

describe('articles', () => {
  it('YYYY/MM配下の*-btc.md記事のslugを返し、INDEX/_template/_experimentsを除外する', () => {
    const slugs = getArticleSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.some((s) => s.includes('_experiments'))).toBe(false);
    expect(slugs.some((s) => s.endsWith('INDEX'))).toBe(false);
    expect(slugs.every((s) => /\d{4}\/\d{2}\/.+-btc$/.test(s))).toBe(true);
  });
  it('slugから本文を取得でき、存在しないslugはnull', () => {
    const slug = getArticleSlugs()[0];
    const a = getArticleBySlug(slug);
    expect(a).not.toBeNull();
    expect(a!.raw.length).toBeGreaterThan(0);
    expect(getArticleBySlug('does/not/exist')).toBeNull();
  });
});
