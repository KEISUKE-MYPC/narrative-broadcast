import { notFound } from 'next/navigation';
import { getIndexRows } from '@/lib/index-parser';
import { getCategory, categoryFromSlug } from '@/lib/categories';
import { domainOf, topicsInDomain, DOMAINS } from '@/lib/taxonomy';
import { topicHubUrl } from '@/lib/urls';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';
import { NarrativeChart, type ChartPoint } from '@/components/NarrativeChart';

export const dynamicParams = false;

export function generateStaticParams() {
  // 全ドメイン×そのトピック
  const params: { domain: string; topic: string }[] = [];
  for (const d of DOMAINS) {
    for (const c of topicsInDomain(d.slug)) params.push({ domain: d.slug, topic: c.slug });
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string; topic: string }> }) {
  const { domain, topic } = await params;
  const cat = getCategory(topic);
  const canonical = topicHubUrl(topic);
  const ogImage = `/og/${topic}`;
  return {
    title: cat.label,
    description: cat.description,
    alternates: { canonical },
    openGraph: { type: 'website', title: cat.label, description: cat.description, url: canonical, images: [ogImage] },
    twitter: { card: 'summary_large_image', title: cat.label, description: cat.description, images: [ogImage] },
  };
}

export default async function TopicHub({ params }: { params: Promise<{ domain: string; topic: string }> }) {
  const { domain, topic } = await params;
  // 未登録/ドメイン不一致は404
  if (domainOf(topic) !== domain || !topicsInDomain(domain).some((c) => c.slug === topic)) notFound();
  const cat = getCategory(topic);

  const rows = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === topic);
  const points: ChartPoint[] = rows.map((r) => ({ datetime: r.datetime, strength: r.strength, narrative: r.narrative }));
  const total = Math.max(1, Math.ceil(rows.length / ARCHIVE_PER_PAGE));
  const pageRows = rows.slice(0, ARCHIVE_PER_PAGE);

  return (
    <div className="container">
      <header className="cat-head">
        <span className="cat-head-chip">{cat.short}</span>
        <h1 className="page-title">{cat.label}</h1>
        <p className="cat-head-desc">{cat.description}</p>
      </header>

      {points.length > 0 && (
        <section className="section">
          <h2 className="section-title"><span className="ja">強度の推移</span></h2>
          <div className="chart-frame">
            <NarrativeChart data={points} color={cat.brand} gradient={cat.brandGradient} />
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title"><span className="ja">分析一覧</span></h2>
        {rows.length > 0 ? (
          <>
            <ArticleList rows={pageRows} />
            <Pagination current={1} total={total} pageHref={(n) => topicHubUrl(topic, n)} />
          </>
        ) : (
          <p className="cat-empty">この分野の分析はまだありません。</p>
        )}
      </section>
    </div>
  );
}
