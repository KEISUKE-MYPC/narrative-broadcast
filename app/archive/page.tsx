import { getIndexRows } from '@/lib/index-parser';
import { ArticleList } from '@/components/ArticleList';

export default function Archive() {
  const rows = getIndexRows(); // INDEXは新しい順
  return (
    <div className="container">
      <h1 className="page-title">アーカイブ</h1>
      <ArticleList rows={rows} />
    </div>
  );
}
