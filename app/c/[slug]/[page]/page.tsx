import { notFound } from 'next/navigation';
import { getIndexRows } from '@/lib/index-parser';
import { CATEGORIES, getCategory, categoryFromSlug } from '@/lib/categories';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';

// 登録済み分野×存在ページのみ静的生成。それ以外は404。
export const dynamicParams = false;

// 分野ごとの記事数からページ総数を出す
function totalPages(slug: string): number {
  const n = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === slug).length;
  return Math.max(1, Math.ceil(n / ARCHIVE_PER_PAGE));
}

// 各分野の2ページ目以降を静的生成（1ページ目は /c/[slug]）
export function generateStaticParams() {
  const params: { slug: string; page: string }[] = [];
  for (const c of CATEGORIES) {
    const total = totalPages(c.slug);
    for (let p = 2; p <= total; p++) params.push({ slug: c.slug, page: String(p) });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug, page } = await params;
  const cat = getCategory(slug);
  return {
    title: `${cat.label} (${page}ページ目)`,
    description: cat.description,
    alternates: { canonical: `/c/${slug}/${page}` },
  };
}

export default async function CategoryPaged({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug, page } = await params;
  if (!CATEGORIES.some((c) => c.slug === slug)) notFound();
  const cat = getCategory(slug);

  const rows = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === slug);
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
        <Pagination current={n} total={total} basePath={`/c/${slug}`} />
      </section>
    </div>
  );
}
