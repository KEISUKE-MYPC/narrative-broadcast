type Opts = { apiKey: string; fetchImpl?: typeof fetch; think?: boolean; model?: string };

// 既定モデル。gemini-3-flash-preview はリード・平易さ・速度(約20s)でbake-off勝者。
// preview版のため廃止リスクあり。その際は model 引数で 'nemotron-3-ultra:cloud' 等へ即フォールバック可。
const DEFAULT_MODEL = 'gemini-3-flash-preview:cloud';

export async function generateArticle(prompt: string, opts: Opts): Promise<string> {
  const f = opts.fetchImpl ?? fetch;
  const body = JSON.stringify({
    model: opts.model ?? DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    think: opts.think ?? true, // 記事生成は推論ON。短い判定タスク等はfalseで高速化
  });
  const call = async () => {
    const res = await f('https://ollama.com/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`Ollama -> ${res.status}`);
    const data = await res.json();
    const content = data?.message?.content;
    if (!content || typeof content !== 'string') throw new Error('empty content');
    // 監査用：サーバーが実際に処理したモデルを各runのログに残す（nemotron呼び出しの証跡）
    console.log(`[generate] server model=${data.model} eval_count=${data.eval_count ?? 'n/a'} chars=${content.length}`);
    return content;
  };
  try {
    return await call();
  } catch (e) {
    console.warn(`[generate] first attempt failed, retrying: ${(e as Error).message}`);
    return await call(); // 1回リトライ。失敗すれば例外伝播
  }
}
