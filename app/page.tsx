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
  const recent = rows.slice(0, 9);

  return (
    <>
      {latest && (
        <section className="hero-band">
          <div className="hero-inner">
            <p className="hero-eyebrow">最新の分析</p>
            <a className="hero-link" href={`/articles/${latest.slug}`}>
              <h1 className="hero-title">{latest.narrative}</h1>
            </a>
            <p className="hero-meta">
              <time>{latest.datetime} JST</time>
              <span className="strength">
                強度 {latest.strength}
                <span className="denom">/10</span>
              </span>
              <span>前回比 {latest.strengthDelta}</span>
            </p>
            <p className="hero-cta">
              <a href={`/articles/${latest.slug}`}>この分析を読む →</a>
            </p>
          </div>
        </section>
      )}

      <div className="container">
        <section className="section">
          <h2 className="section-title">
            <span className="ja">ナラティブ遷移 — 強度の推移</span>
          </h2>
          <div className="chart-frame">
            <NarrativeChart data={chart} />
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">
            <span className="ja">最近の分析</span>
          </h2>
          <ArticleList rows={recent} />
          <p className="see-all">
            <a href="/archive">すべての分析を見る →</a>
          </p>
        </section>
      </div>
    </>
  );
}
