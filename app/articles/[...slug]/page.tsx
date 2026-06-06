import { getArticleSlugs, getArticleBySlug } from '@/lib/articles';
import { renderMarkdown } from '@/lib/markdown';
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
  return <article className="article" dangerouslySetInnerHTML={{ __html: html }} />;
}
