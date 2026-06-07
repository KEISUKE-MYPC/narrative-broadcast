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
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-status">
              <span className="hero-live">
                <span className="hero-live-dot" aria-hidden="true" />
                ライブ解析
              </span>
              <span className="hero-status-sep" aria-hidden="true">/</span>
              <span className="hero-cadence">{latest.cycle}サイクル</span>
              <span className="hero-status-sep" aria-hidden="true">/</span>
              <time className="hero-time">{latest.datetime} JST</time>
            </div>

            <a className="hero-link" href={`/articles/${latest.slug}`}>
              <h1 className="hero-title">{latest.narrative}</h1>
            </a>

            <div className="hero-rail">
              <span className="hero-strength">
                <span className="hero-strength-label">支配的強度</span>
                <span className="hero-strength-value">
                  {latest.strength}
                  <span className="hero-strength-unit">/10</span>
                </span>
                <span className="hero-strength-delta">前回比 {latest.strengthDelta}</span>
              </span>
              <a className="hero-go" href={`/articles/${latest.slug}`}>
                この分析を読む
                <span className="hero-go-arrow" aria-hidden="true">→</span>
              </a>
            </div>
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
