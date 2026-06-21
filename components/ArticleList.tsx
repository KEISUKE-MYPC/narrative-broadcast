import type { IndexRow } from '@/lib/index-parser';
import { Eyecatch } from '@/components/Eyecatch';
import { articleUrl } from '@/lib/urls';

export function ArticleList({ rows }: { rows: IndexRow[] }) {
  return (
    <ul className="card-grid">
      {rows.map((r) => (
        <li key={r.slug} className="analysis-card">
          <a href={articleUrl(r.slug)}>
            <Eyecatch slug={r.slug} strength={r.strength} variant="card" />
            <div className="ac-body">
              <h3 className="ac-title">{r.narrative}</h3>
              <div className="ac-meta">
                <span className="ac-date">{r.datetime} JST</span>
                <span className="ac-strength">
                  強度 {r.strength}
                  <span className="denom">/10</span>
                </span>
              </div>
              <span className="ac-delta">前回比 {r.strengthDelta}・{r.cycle}</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
