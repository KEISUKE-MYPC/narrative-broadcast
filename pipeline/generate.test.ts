import { describe, it, expect, vi } from 'vitest';
import { generateArticle } from './generate';

// Gemini generateContent の成功レスポンス
const ok = (text: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
});
const err = (status: number) => ({ ok: false, status, json: async () => ({}), text: async () => '' });

describe('generateArticle (Gemini API)', () => {
  it('returns the joined text from candidates parts', async () => {
    const stub = vi.fn().mockResolvedValue(ok('# T\n本文'));
    const out = await generateArticle('PROMPT', { apiKey: 'k', model: 'gemini-3-flash-preview', fetchImpl: stub as any });
    expect(out).toContain('# T');
    expect(stub).toHaveBeenCalledOnce();
  });

  it('drops thinking (thought) parts and keeps body text', async () => {
    const stub = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '推論', thought: true }, { text: '本文' }] } }] }),
    });
    const out = await generateArticle('P', { apiKey: 'k', model: 'gemini-3-flash-preview', fetchImpl: stub as any });
    expect(out).toBe('本文');
  });

  it('falls back to the next model when the first errors', async () => {
    const stub = vi.fn()
      .mockResolvedValueOnce(err(500))        // chain[0] gemini-3-flash-preview 失敗
      .mockResolvedValueOnce(ok('FALLBACK')); // chain[1] gemma で成功
    const out = await generateArticle('P', { apiKey: 'k', fetchImpl: stub as any });
    expect(out).toBe('FALLBACK');
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it('retries 503 on the same model before moving on', async () => {
    const stub = vi.fn()
      .mockResolvedValueOnce(err(503))   // 1回目503
      .mockResolvedValueOnce(ok('OK'));  // リトライで成功
    const out = await generateArticle('P', { apiKey: 'k', model: 'gemini-3-flash-preview', fetchImpl: stub as any });
    expect(out).toBe('OK');
    expect(stub).toHaveBeenCalledTimes(2);
  }, 20000);

  it('throws when every model in the chain fails', async () => {
    const stub = vi.fn().mockResolvedValue(err(500));
    await expect(generateArticle('P', { apiKey: 'k', fetchImpl: stub as any })).rejects.toThrow();
  });
});
