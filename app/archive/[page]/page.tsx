import { getIndexRows } from '@/lib/index-parser';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';
import { notFound } from 'next/navigation';

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  return {
    title: `アーカイブ (${page}ページ目)`,
    alternates: { canonical: `/archive/${page}` },
  };
}

function totalPages(): number {
  return Math.max(1, Math.ceil(getIndexRows().length / ARCHIVE_PER_PAGE));
}

// 2ページ目以降を静的生成（1ページ目は /archive）
export function generateStaticParams() {
  const total = totalPages();
  const params: { page: string }[] = [];
  for (let p = 2; p <= total; p++) params.push({ page: String(p) });
  return params;
}

export default async function ArchivePaged({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const n = Number(page);
  const rows = getIndexRows();
  const total = Math.max(1, Math.ceil(rows.length / ARCHIVE_PER_PAGE));
  if (!Number.isInteger(n) || n < 2 || n > total) notFound();

  const pageRows = rows.slice((n - 1) * ARCHIVE_PER_PAGE, n * ARCHIVE_PER_PAGE);
  return (
    <div className="container">
      <h1 className="page-title">
        アーカイブ <span className="page-sub">{n} / {total}</span>
      </h1>
      <ArticleList rows={pageRows} />
      <Pagination current={n} total={total} />
    </div>
  );
}
