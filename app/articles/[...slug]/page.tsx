import { getArticleSlugs, getArticleBySlug } from '@/lib/articles';
import { renderMarkdown, extractToc } from '@/lib/markdown';
import { categoryFromSlug } from '@/lib/categories';
import { TableOfContents } from '@/components/TableOfContents';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug: slug.split('/') }));
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.join('/');
  const article = getArticleBySlug(slugPath);
  if (!article) notFound();
  const html = await renderMarkdown(article.raw);
  const toc = extractToc(html);
  const cat = categoryFromSlug(slugPath);

  return (
    <div className="container article-layout">
      <div className="article-col">
        <nav className="crumbs" aria-label="パンくず">
          <a href="/">ホーム</a>
          <span className="crumbs-sep" aria-hidden="true">›</span>
          <a href="/archive">アーカイブ</a>
          <span className="crumbs-sep" aria-hidden="true">›</span>
          <span className="cat-chip">{cat.short}</span>
        </nav>
        <article className="article" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <TableOfContents items={toc} />
    </div>
  );
}
