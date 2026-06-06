import { getIndexRows } from '@/lib/index-parser';
import { ArticleList } from '@/components/ArticleList';
import { NarrativeChart } from '@/components/NarrativeChart';

export default function Home() {
  const rows = getIndexRows();
  const latest = rows[0];
  const chart = rows.map((r) => ({
    datetime: r.datetime,
    strength: r.strength,
    narrative: r.narrative,
  }));
  const recent = rows.slice(0, 8);

  return (
    <>
      {latest && (
        <section className="hero">
          <p className="eyebrow">最新の分析</p>
          <a className="hero-link" href={`/articles/${latest.slug}`}>
            <h1>{latest.narrative}</h1>
          </a>
          <p className="meta">
            <time>{latest.datetime} JST</time>
            <span className="strength">
              強度 {latest.strength}
              <span className="denom">/10</span>
            </span>
            <span className="delta">前回比 {latest.strengthDelta}</span>
          </p>
        </section>
      )}

      <section className="chart">
        <h2 className="section-title">ナラティブ遷移 — 強度の推移</h2>
        <div className="chart-frame">
          <NarrativeChart data={chart} />
        </div>
      </section>

      <section className="recent">
        <h2 className="section-title">最近の分析</h2>
        <ArticleList rows={recent} />
        <p className="see-all">
          <a href="/archive">すべての分析を見る →</a>
        </p>
      </section>
    </>
  );
}
