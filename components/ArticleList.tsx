import type { IndexRow } from '@/lib/index-parser';

export function ArticleList({ rows }: { rows: IndexRow[] }) {
  return (
    <ul className="article-list">
      {rows.map((r) => (
        <li key={r.slug} className="article-card">
          <a href={`/articles/${r.slug}`}>
            <span className="narrative">{r.narrative}</span>
            <span className="card-strength">
              {r.strength}
              <span className="denom">/10</span>
            </span>
            <span className="meta">
              {r.datetime} JST・{r.cycle}・前回比 {r.strengthDelta}
            </span>
            <span className="keydata">{r.keyData}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
