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
  const recent = rows.slice(0, 10);
  return (
    <>
      <section className="hero">
        <p className="hero-label">最新の分析</p>
        {latest && (
          <a className="hero-link" href={`/articles/${latest.slug}`}>
            <h1>{latest.narrative}</h1>
            <p className="meta">
              {latest.datetime}・強度 {latest.strength}/10（{latest.strengthDelta}）
            </p>
          </a>
        )}
      </section>
      <section className="chart">
        <h2>ナラティブ遷移（強度推移）</h2>
        <NarrativeChart data={chart} />
      </section>
      <section className="recent">
        <h2>最近の記事</h2>
        <ArticleList rows={recent} />
        <p>
          <a href="/archive">すべて見る →</a>
        </p>
      </section>
    </>
  );
}
