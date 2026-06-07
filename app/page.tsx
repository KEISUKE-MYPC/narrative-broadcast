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
      <section className="hero-band">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-inner">
          <p className="hero-tagline">
            市場参加者の物語と認知を6時間ごとに構造分析するナラティブの観測メディア
          </p>
          <h1 className="hero-brand">
            Narrative Broadcast
          </h1>
          <p className="hero-note">
            <span className="hero-live">
              <span className="hero-live-dot" aria-hidden="true" />
              ライブ解析
            </span>
            <span className="hero-status-sep" aria-hidden="true">/</span>
            <span>6時間ごとに更新</span>
            {latest && (
              <>
                <span className="hero-status-sep" aria-hidden="true">/</span>
                <span>最終更新 {latest.datetime} JST</span>
              </>
            )}
          </p>
        </div>
      </section>

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
