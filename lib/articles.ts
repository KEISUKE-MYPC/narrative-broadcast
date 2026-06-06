import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ARTICLES_DIR = join(process.cwd(), 'articles');

export type Article = { slug: string; raw: string };

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '_experiments') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\d{4}-\d{2}-\d{2}.*-btc\.md$/.test(name)) out.push(full);
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
