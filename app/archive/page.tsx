import { getIndexRows } from '@/lib/index-parser';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';

export default function Archive() {
  const rows = getIndexRows(); // INDEXは新しい順
  const total = Math.max(1, Math.ceil(rows.length / ARCHIVE_PER_PAGE));
  const pageRows = rows.slice(0, ARCHIVE_PER_PAGE);
  return (
    <div className="container">
      <h1 className="page-title">アーカイブ</h1>
      <ArticleList rows={pageRows} />
      <Pagination current={1} total={total} />
    </div>
  );
}
