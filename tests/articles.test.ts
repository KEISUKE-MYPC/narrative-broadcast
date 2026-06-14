import { describe, it, expect } from 'vitest';
import { getArticleSlugs, getArticleBySlug } from '../lib/articles';
import { CATEGORIES } from '../lib/categories';

describe('articles', () => {
  it('YYYY/MM配下の登録分野(*-<slug>.md)記事のslugを返し、INDEX/_template/_experimentsを除外する', () => {
    const slugs = getArticleSlugs();
    // 記事ファイルの接尾辞は登録分野（btc/eth/xrp/sol…）に追従する
    const suffixes = CATEGORIES.map((c) => c.slug).join('|');
    const slugRe = new RegExp(`\\d{4}/\\d{2}/.+-(?:${suffixes})$`);
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.some((s) => s.includes('_experiments'))).toBe(false);
    expect(slugs.some((s) => s.endsWith('INDEX'))).toBe(false);
    expect(slugs.every((s) => slugRe.test(s))).toBe(true);
  });
  it('slugから本文を取得でき、存在しないslugはnull', () => {
    const slug = getArticleSlugs()[0];
    const a = getArticleBySlug(slug);
    expect(a).not.toBeNull();
    expect(a!.raw.length).toBeGreaterThan(0);
    expect(getArticleBySlug('does/not/exist')).toBeNull();
  });
});
