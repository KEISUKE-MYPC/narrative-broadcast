import { domainOf } from './taxonomy';

// 旧URL → 新URL。対象外（既に新URL・静的ルート等）は null。
export function legacyRedirect(pathname: string): string | null {
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
