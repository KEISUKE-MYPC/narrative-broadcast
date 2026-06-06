import { getArticleSlugs, getArticleBySlug } from '@/lib/articles';
import { renderMarkdown, extractToc } from '@/lib/markdown';
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
  const article = getArticleBySlug(slug.join('/'));
  if (!article) notFound();
  const html = await renderMarkdown(article.raw);
  const toc = extractToc(html);

  return (
    <div className="container article-layout">
      <div className="article-col">
        <p className="back-link">
          <a href="/archive">← アーカイブ</a>
        </p>
        <article className="article" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <TableOfContents items={toc} />
    </div>
  );
}
