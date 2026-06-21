import { notFound } from 'next/navigation';
import { getIndexRows } from '@/lib/index-parser';
import { getCategory, categoryFromSlug } from '@/lib/categories';
import { domainOf, topicsInDomain, DOMAINS } from '@/lib/taxonomy';
import { topicHubUrl } from '@/lib/urls';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';

export const dynamicParams = false;

function totalPages(topic: string): number {
  const n = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === topic).length;
  return Math.max(1, Math.ceil(n / ARCHIVE_PER_PAGE));
}

export function generateStaticParams() {
  const params: { domain: string; topic: string; page: string }[] = [];
  for (const d of DOMAINS) {
    for (const c of topicsInDomain(d.slug)) {
      const total = totalPages(c.slug);
      for (let p = 2; p <= total; p++) params.push({ domain: d.slug, topic: c.slug, page: String(p) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; topic: string; page: string }>;
}) {
  const { topic, page } = await params;
  const cat = getCategory(topic);
  return {
    title: `${cat.label} (${page}ページ目)`,
    description: cat.description,
    alternates: { canonical: topicHubUrl(topic, Number(page)) },
  };
}

export default async function TopicPaged({
  params,
}: {
  params: Promise<{ domain: string; topic: string; page: string }>;
}) {
  const { domain, topic, page } = await params;
  if (domainOf(topic) !== domain || !topicsInDomain(domain).some((c) => c.slug === topic)) notFound();
  const cat = getCategory(topic);

  const rows = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === topic);
  const n = Number(page);
  const total = Math.max(1, Math.ceil(rows.length / ARCHIVE_PER_PAGE));
  if (!Number.isInteger(n) || n < 2 || n > total) notFound();

  const pageRows = rows.slice((n - 1) * ARCHIVE_PER_PAGE, n * ARCHIVE_PER_PAGE);

  return (
    <div className="container">
      <header className="cat-head">
        <span className="cat-head-chip">{cat.short}</span>
        <h1 className="page-title">
          {cat.label} <span className="page-sub">{n} / {total}</span>
        </h1>
      </header>

      <section className="section">
        <ArticleList rows={pageRows} />
        <Pagination current={n} total={total} pageHref={(p) => topicHubUrl(topic, p)} />
      </section>
    </div>
  );
}
