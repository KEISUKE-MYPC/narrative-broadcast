import { describe, it, expect } from 'vitest';
import { DOMAINS, getDomain, domainOf, topicsInDomain } from './taxonomy';

describe('taxonomy', () => {
  it('crypto ドメインが登録されている', () => {
    expect(DOMAINS.map((d) => d.slug)).toContain('crypto');
  });
  it('getDomain は未登録で undefined', () => {
    expect(getDomain('crypto')?.slug).toBe('crypto');
    expect(getDomain('rwa')).toBeUndefined();
  });
  it('domainOf は topic→ドメイン、未知は crypto', () => {
    expect(domainOf('btc')).toBe('crypto');
    expect(domainOf('weekly')).toBe('crypto');
    expect(domainOf('unknown')).toBe('crypto');
  });
  it('topicsInDomain は crypto の全トピックを返す', () => {
    const slugs = topicsInDomain('crypto').map((c) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(['btc', 'eth', 'xrp', 'sol', 'weekly']));
  });
});
