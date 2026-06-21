import { getArticleSlugs, getArticleBySlug, resolveArticleByStampTopic } from '@/lib/articles';
import { renderMarkdown, extractToc } from '@/lib/markdown';
import { categoryFromSlug } from '@/lib/categories';
import { domainOf } from '@/lib/taxonomy';
import { stampFromSlug } from '@/lib/urls';
import { getIndexRowBySlug } from '@/lib/index-parser';
import { Eyecatch } from '@/components/Eyecatch';
import { TableOfContents } from '@/components/TableOfContents';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { articleJsonLd, breadcrumbJsonLd, publishedISO } from '@/lib/seo';
import { getArticleDescription } from '@/lib/excerpt';
import { ArticleList } from '@/components/ArticleList';
import { getRelatedRows } from '@/lib/related';
import { shortTitle } from '@/lib/title';

export const dynamicParams = false;

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => {
    const topic = categoryFromSlug(slug).slug;
    return { domain: domainOf(topic), topic, stamp: stampFromSlug(slug) };
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; topic: string; stamp: string }>;
}) {
  const { domain, topic, stamp } = await params;
  const slugPath = resolveArticleByStampTopic(stamp, topic);
  if (!slugPath) return {};
  const row = getIndexRowBySlug(slugPath);
  const title = shortTitle(row?.narrative ?? 'ナラティブ分析');
  const ogImage = `/og/${categoryFromSlug(slugPath).slug}`;
  const description = getArticleDescription(slugPath);
  const canonical = `/${domain}/${topic}/${stamp}`;
  const publishedTime = publishedISO(slugPath);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: [ogImage],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ domain: string; topic: string; stamp: string }>;
}) {
  const { topic, stamp } = await params;
  const slugPath = resolveArticleByStampTopic(stamp, topic);
  if (!slugPath) notFound();
  const article = getArticleBySlug(slugPath);
  if (!article) notFound();
  const html = await renderMarkdown(article.raw);
  const toc = extractToc(html);
  const cat = categoryFromSlug(slugPath);
  const row = getIndexRowBySlug(slugPath);
  const description = getArticleDescription(slugPath);
  const ogImage = `/og/${cat.slug}`;
  const seoData = [
    articleJsonLd({ slug: slugPath, title: shortTitle(row?.narrative ?? 'ナラティブ分析'), description, image: ogImage }),
    breadcrumbJsonLd({ slug: slugPath, categoryShort: cat.short }),
  ];
  const related = getRelatedRows(slugPath);

  return (
    <>
      <JsonLd data={seoData} />
      <div className="container article-layout">
      <div className="article-col">
        <nav className="crumbs" aria-label="パンくず">
          <a href="/">ホーム</a>
          <span className="crumbs-sep" aria-hidden="true">›</span>
          <a href="/archive">アーカイブ</a>
          <span className="crumbs-sep" aria-hidden="true">›</span>
          <span className="cat-chip">{cat.short}</span>
        </nav>
        <Eyecatch
          slug={slugPath}
          strength={row?.strength}
          datetime={row?.datetime}
          variant="hero"
        />
        <article className="article" dangerouslySetInnerHTML={{ __html: html }} />
        {related.length > 0 && (
          <section className="related-articles">
            <h2 className="section-title">
              <span className="ja">関連する分析</span>
            </h2>
            <ArticleList rows={related} />
          </section>
        )}
      </div>
      <TableOfContents items={toc} />
    </div>
    </>
  );
}
