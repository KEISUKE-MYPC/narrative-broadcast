// ページ送り。ページ1は basePath、2以降は <basePath>/<n>。
// 例: basePath='/archive' → /archive, /archive/2 ／ basePath='/c/btc' → /c/btc, /c/btc/2
function href(basePath: string, p: number): string {
  return p <= 1 ? basePath : `${basePath}/${p}`;
}

// 表示するページ番号（先頭・末尾・現在の前後＋省略記号）
function pageItems(current: number, total: number): (number | '…')[] {
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const nums = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of nums) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({
  current,
  total,
  basePath = '/archive',
  pageHref,
}: {
  current: number;
  total: number;
  basePath?: string;
  pageHref?: (n: number) => string;
}) {
  if (total <= 1) return null;
  const link = (p: number) => (pageHref ? pageHref(p) : href(basePath, p));
  const items = pageItems(current, total);

  return (
    <nav className="pagination" aria-label="ページ送り">
      {current > 1 && (
        <a className="pg-link" href={link(current - 1)} rel="prev">
          ← 前へ
        </a>
      )}
      <ul className="pg-list">
        {items.map((it, i) =>
          it === '…' ? (
            <li key={`e${i}`} className="pg-ellipsis" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={it}>
              {it === current ? (
                <span className="pg-num is-current" aria-current="page">
                  {it}
                </span>
              ) : (
                <a className="pg-num" href={link(it)}>
                  {it}
                </a>
              )}
            </li>
          ),
        )}
      </ul>
      {current < total && (
        <a className="pg-link" href={link(current + 1)} rel="next">
          次へ →
        </a>
      )}
    </nav>
  );
}
