type Opts = { apiKey: string; fetchImpl?: typeof fetch; think?: boolean; model?: string };

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// 執筆モデルチェーン。順に試し、503/エラー/空なら次へ。すべて公式Gemini API・無料枠で稼働。
// 1=質トップ(preview)、2=別系統の安定版(障害が相関しにくい)、3=最終手段(必ず速く通る)。
// preview廃止時は1行差し替え（フォールバックが効くので無人でも止まらない）。
const DEFAULT_CHAIN = ['gemini-3-flash-preview', 'gemma-4-31b-it', 'gemini-flash-lite-latest'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 単一モデルで generateContent を叩く。503は最大4回までbackoffリトライ。
async function callModel(
  f: typeof fetch, apiKey: string, model: string, prompt: string, think?: boolean,
): Promise<string> {
  // 記事生成はthinking既定ON。think:false（backfill判定等）はthinkingBudget:0で無効化。
  // thinkingConfigはgeminiモデルのみ対応のためgemmaには付けない。
  const generationConfig =
    think === false && /gemini/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : undefined;
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(generationConfig ? { generationConfig } : {}) });

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await f(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res.status === 503 && attempt < 5) {
      await sleep(attempt * 4000); // 4s,8s,12s,16s
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${model} -> ${res.status}`);
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    // thinking部(thought=true)は除き、本文textのみ連結
    const content = parts.filter((p: any) => p?.text && !p?.thought).map((p: any) => p.text).join('');
    if (!content) throw new Error(`Gemini ${model} -> empty (finishReason=${data?.candidates?.[0]?.finishReason})`);
    console.log(`[generate] model=${model} chars=${content.length}`);
    return content;
  }
  throw new Error(`Gemini ${model} -> 503 exhausted`);
}

export async function generateArticle(prompt: string, opts: Opts): Promise<string> {
  const f = opts.fetchImpl ?? fetch;
  // opts.model指定時はそれ単体、未指定時はDEFAULT_CHAINを順に試す。
  const chain = opts.model ? [opts.model] : DEFAULT_CHAIN;
  let lastErr: Error | null = null;
  for (const model of chain) {
    try {
      return await callModel(f, opts.apiKey, model, prompt, opts.think);
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[generate] ${model} failed, trying next: ${lastErr.message}`);
    }
  }
  throw lastErr ?? new Error('generateArticle: no model succeeded');
}
