// 見出し（narrative）を <title>/og 用に短縮する純粋関数。
// max字以内ならそのまま。超える場合は max字以内の最後の自然な区切りで切り、
// 適切な区切りが無ければ max字でハード切りし、いずれも末尾に … を付す。
const BREAKS = ['。', '、', '／', '・', '―', '：'];

export function shortTitle(narrative: string, max = 40): string {
  const s = narrative.trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  let cut = -1;
  for (const b of BREAKS) {
    const i = head.lastIndexOf(b);
    if (i > cut) cut = i;
  }
  // 区切りが後方(max*0.6以降)にある時だけ採用し、極端に短いタイトルを避ける
  if (cut >= Math.floor(max * 0.6)) return head.slice(0, cut) + '…';
  return head + '…';
}
