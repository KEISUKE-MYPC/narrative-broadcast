import { getIndexRows } from '@/lib/index-parser';
import { categoryFromSlug, CATEGORIES } from '@/lib/categories';
import { ArticleList } from '@/components/ArticleList';
import { ChartSwitcher, type ChartSeries } from '@/components/ChartSwitcher';
import { Wordmark } from '@/components/Wordmark';

export default function Home() {
  const rows = getIndexRows();
  const latest = rows[0];
  const recent = rows.slice(0, 9);

  // 分野ごとの強度系列（データのある分野のみ・全期間／チャート側で横スクロール表示）
  const series: ChartSeries[] = CATEGORIES.map((c) => ({
    slug: c.slug,
    short: c.short,
    label: c.label,
    color: c.ogAccent,
    points: rows
      .filter((r) => categoryFromSlug(r.slug).slug === c.slug)
      .map((r) => ({ datetime: r.datetime, strength: r.strength, narrative: r.narrative })),
  })).filter((s) => s.points.length > 0);

  return (
    <>
      <section className="hero-band">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-inner">
          <p className="hero-tagline">
            市場参加者の物語と認知を構造分析する<br />ナラティブ観測メディア
          </p>
          <Wordmark />
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
          <ChartSwitcher series={series} />
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
