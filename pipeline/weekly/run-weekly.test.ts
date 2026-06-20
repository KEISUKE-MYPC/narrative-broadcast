import { describe, it, expect } from 'vitest';
import { runWeekly } from './run-weekly';
import type { IndexRow } from '../../lib/index-parser';

const row = (datetime: string, slug: string, strength: number): IndexRow => ({
  datetime, cycle: '6h', narrative: '語り', strength, strengthDelta: '±0', keyData: 'k', slug,
});

describe('runWeekly（依存注入・ドライラン）', () => {
  it('収集→生成→計器盤付与→公開を通す。生成プロンプトに合成強度が渡る', async () => {
    const now = new Date('2026-06-21T12:00:00Z');
    const rows = [
      row('2026-06-16 06:00', '2026/06/2026-06-16-0600-6h-btc', 2),
      row('2026-06-20 12:00', '2026/06/2026-06-20-1200-6h-btc', 4),
    ];
    let seenPrompt = '';
    const published: string[] = [];
    const res = await runWeekly(now, {
      rows,
      getArticle: () => `# t
**ナラティブ強度：3/10**

## 実データ計器盤（出典）

| 指標 | 実測値 | ソース |
|---|---|---|
| 価格 | $64,000 | CoinGecko |

※本記事は情報提供を目的としたものであり、投資助言ではありません。
`,
      generate: async (prompt: string) => { seenPrompt = prompt; return `# 週次タイトル
**ナラティブ強度：4/10**
本文。
※本記事は情報提供を目的としたものであり、投資助言ではありません。
`; },
      publish: (opts) => { published.push(opts.markdown); return { path: 'p', skipped: false }; },
    });
    expect(seenPrompt).toContain('合成強度は 4/10');
    // 公開された本文に週間計器盤が差し込まれている
    expect(published[0]).toContain('## 週間計器盤（W/W）');
    expect(res.skipped).toBe(false);
  });
});
