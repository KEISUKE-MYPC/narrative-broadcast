import { domainOf } from './taxonomy';

// 旧命名（HHMM無し）の最初期記事。正規化リネーム前のURL救済（1件のみ）。
const LEGACY_ARTICLE_URLS: Record<string, string> = {
  '/articles/2026/06/2026-06-04-6h-btc': '/crypto/btc/2026-06-04-2325',
};

// 旧URL → 新URL。対象外（既に新URL・静的ルート等）は null。
export function legacyRedirect(pathname: string): string | null {
  // HHMM無しの最初期記事（特殊ケース）
  const normalized = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (LEGACY_ARTICLE_URLS[normalized]) return LEGACY_ARTICLE_URLS[normalized];
  // /articles/{y}/{m}/{file}
  const art = pathname.match(/^\/articles\/(.+?)\/?$/);
  if (art) {
    const file = art[1].split('/').pop() ?? art[1];
    const stamp = (file.match(/^(\d{4}-\d{2}-\d{2}-\d{4})/) ?? [])[1];
    const topic = (file.match(/-([a-z0-9]+)$/) ?? [])[1];
    if (!stamp || !topic) return null;
    return `/${domainOf(topic)}/${topic}/${stamp}`;
  }
  // /c/{topic}/{n}
  const cPaged = pathname.match(/^\/c\/([a-z0-9]+)\/(\d+)\/?$/);
  if (cPaged) {
    const [, topic, n] = cPaged;
    const base = `/${domainOf(topic)}/${topic}`;
    return Number(n) >= 2 ? `${base}/page/${n}` : base;
  }
  // /c/{topic}
  const cHub = pathname.match(/^\/c\/([a-z0-9]+)\/?$/);
  if (cHub) {
    const topic = cHub[1];
    return `/${domainOf(topic)}/${topic}`;
  }
  return null;
}
