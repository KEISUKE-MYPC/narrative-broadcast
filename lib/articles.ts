import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CATEGORIES } from './categories';

const ARTICLES_DIR = join(process.cwd(), 'articles');

export type Article = { slug: string; raw: string };

// 「YYYY-MM-DD…-<分野>.md」形式の記事ファイルだけを拾う。
// 分野はレジストリの slug から動的に組み立てる（例: btc|eth|macro）。
const SUFFIXES = CATEGORIES.map((c) => c.slug).join('|');
const ARTICLE_FILE = new RegExp(`\\d{4}-\\d{2}-\\d{2}.*-(?:${SUFFIXES})\\.md$`);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '_experiments') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (ARTICLE_FILE.test(name)) out.push(full);
  }
  return out;
}

export function getArticleSlugs(): string[] {
  return walk(ARTICLES_DIR).map((f) =>
    relative(ARTICLES_DIR, f).replace(/\\/g, '/').replace(/\.md$/, '')
  );
}

export function getArticleBySlug(slug: string): Article | null {
  const file = join(ARTICLES_DIR, `${slug}.md`);
  if (!existsSync(file)) return null;
  return { slug, raw: readFileSync(file, 'utf8') };
}

// slug一覧から、ファイル名が「{stamp}-…-{topic}」に一致するものを返す（純関数）。
export function findSlugByStampTopic(slugs: string[], stamp: string, topic: string): string | null {
  return slugs.find((s) => {
    const file = s.split('/').pop() ?? s;
    return file.startsWith(`${stamp}-`) && file.endsWith(`-${topic}`);
  }) ?? null;
}

// stamp + topic から記事slugを解決する（無ければ null）。
export function resolveArticleByStampTopic(stamp: string, topic: string): string | null {
  return findSlugByStampTopic(getArticleSlugs(), stamp, topic);
}
