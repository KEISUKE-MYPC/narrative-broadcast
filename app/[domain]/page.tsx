import { notFound } from 'next/navigation';
import { getDomain, topicsInDomain, domainOf, DOMAINS } from '@/lib/taxonomy';
import { topicHubUrl, domainHubUrl } from '@/lib/urls';
import { getIndexRows } from '@/lib/index-parser';
import { categoryFromSlug } from '@/lib/categories';
import { ArticleList } from '@/components/ArticleList';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';

export const dynamicParams = false;

export function generateStaticParams() {
  return DOMAINS.map((d) => ({ domain: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const d = getDomain(domain);
  if (!d) return {};
  return {
    title: d.label,
    description: d.description,
    alternates: { canonical: domainHubUrl(domain) },
    openGraph: { type: 'website', title: d.label, description: d.description, url: domainHubUrl(domain) },
  };
}

export default async function DomainHub({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const d = getDomain(domain);
  if (!d) notFound();

  const topics = topicsInDomain(domain);
  // ドメイン内の最新記事（INDEXは新しい順）
  const rows = getIndexRows()
    .filter((r) => domainOf(categoryFromSlug(r.slug).slug) === domain)
    .slice(0, ARCHIVE_PER_PAGE);

  return (
    <div className="container">
      <header className="cat-head">
        <h1 className="page-title">{d.label}</h1>
        <p className="cat-head-desc">{d.description}</p>
      </header>

      <section className="section">
        <h2 className="section-title"><span className="ja">トピック</span></h2>
        <ul className="card-grid">
          {topics.map((c) => (
            <li key={c.slug} className="analysis-card">
              <a href={topicHubUrl(c.slug)}>
                <div className="ac-body">
                  <h3 className="ac-title">{c.label}</h3>
                  <span className="ac-delta">{c.description}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {rows.length > 0 && (
        <section className="section">
          <h2 className="section-title"><span className="ja">最新の分析</span></h2>
          <ArticleList rows={rows} />
        </section>
      )}
    </div>
  );
}
