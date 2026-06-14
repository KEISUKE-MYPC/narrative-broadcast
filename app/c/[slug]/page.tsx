import { notFound } from 'next/navigation';
import { getIndexRows } from '@/lib/index-parser';
import { CATEGORIES, getCategory, categoryFromSlug } from '@/lib/categories';
import { ArticleList } from '@/components/ArticleList';
import { Pagination } from '@/components/Pagination';
import { ARCHIVE_PER_PAGE } from '@/lib/pagination';
import { NarrativeChart, type ChartPoint } from '@/components/NarrativeChart';

// 登録済み分野（btc/eth…）だけを静的生成し、それ以外のslugは404にする
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = getCategory(slug);
  const title = cat.label;
  const description = cat.description;
  const canonical = `/c/${slug}`;
  const ogImage = `/og/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical, images: [ogImage] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // dynamicParams=false で未登録slugは届かないが、念のためガード
  if (!CATEGORIES.some((c) => c.slug === slug)) notFound();
  const cat = getCategory(slug);

  // 当該分野の記事のみ（INDEXは新しい順）
  const rows = getIndexRows().filter((r) => categoryFromSlug(r.slug).slug === slug);
  // チャートは全期間（推移の俯瞰用）、一覧は1ページ目だけページング表示
  const points: ChartPoint[] = rows.map((r) => ({
    datetime: r.datetime,
    strength: r.strength,
    narrative: r.narrative,
  }));
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
          <h2 className="section-title">
            <span className="ja">強度の推移</span>
          </h2>
          <div className="chart-frame">
            <NarrativeChart data={points} color={cat.ogAccent} />
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">
          <span className="ja">分析一覧</span>
        </h2>
        {rows.length > 0 ? (
          <>
            <ArticleList rows={pageRows} />
            <Pagination current={1} total={total} basePath={`/c/${slug}`} />
          </>
        ) : (
          <p className="cat-empty">この分野の分析はまだありません。</p>
        )}
      </section>
    </div>
  );
}
