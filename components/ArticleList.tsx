import type { IndexRow } from '@/lib/index-parser';
import { categoryFromSlug } from '@/lib/categories';

export function ArticleList({ rows }: { rows: IndexRow[] }) {
  return (
    <ul className="card-grid">
      {rows.map((r) => {
        const cat = categoryFromSlug(r.slug);
        return (
        <li key={r.slug} className="analysis-card">
          <a href={`/articles/${r.slug}`}>
            <div className="ac-head">
              <span className="cat-chip">{cat.short}</span>
              <span className="ac-date">{r.datetime} JST</span>
              <span className="ac-strength">
                強度 {r.strength}
                <span className="denom">/10</span>
              </span>
            </div>
            <h3 className="ac-title">{r.narrative}</h3>
            <p className="ac-data">{r.keyData}</p>
            <span className="ac-delta">前回比 {r.strengthDelta}・{r.cycle}</span>
          </a>
        </li>
        );
      })}
    </ul>
  );
}
