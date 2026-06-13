import { describe, it, expect, vi } from 'vitest';
import { generateArticle } from './generate';

describe('generateArticle', () => {
  it('returns message.content from the API', async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '# T\n本文' } }),
    });
    const out = await generateArticle('PROMPT', { apiKey: 'k', fetchImpl: stub as any });
    expect(out).toContain('# T');
    expect(stub).toHaveBeenCalledOnce();
  });

  it('retries once on failure then succeeds', async () => {
    const stub = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: 'OK' } }) });
    const out = await generateArticle('P', { apiKey: 'k', fetchImpl: stub as any });
    expect(out).toBe('OK');
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('throws after second failure', async () => {
    const stub = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(generateArticle('P', { apiKey: 'k', fetchImpl: stub as any }))
      .rejects.toThrow();
  });
});
