import type { IndexRow } from '@/lib/index-parser';

export function ArticleList({ rows }: { rows: IndexRow[] }) {
  return (
    <ul className="article-list">
      {rows.map((r) => (
        <li key={r.slug} className="article-card">
          <a href={`/articles/${r.slug}`}>
            <span className="meta">
              {r.datetime}・{r.cycle}・強度 {r.strength}/10（{r.strengthDelta}）
            </span>
            <span className="narrative">{r.narrative}</span>
            <span className="keydata">{r.keyData}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
