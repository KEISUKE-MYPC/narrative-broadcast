import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';

export type TocItem = { id: string; text: string; depth: 2 | 3 };

/** 冒頭の「> ⚠️ 自動生成…／自動下書き…」バナー（blockquote）を除去する。
 *  通常の引用は残す。 */
function stripAutoNotice(md: string): string {
  return md
    .split('\n')
    .filter((line) => !/^>\s*⚠️?\s*自動(生成|下書き)/.test(line.trim()))
    .join('\n')
    .replace(/^\s+/, '');
}

export async function renderMarkdown(raw: string): Promise<string> {
  const { content } = matter(raw); // frontmatter無しでも安全に本文を取り出す
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeStringify)
    .process(stripAutoNotice(content));
  return String(file);
}

/** レンダリング済みHTMLから h2/h3 見出しを抽出して目次を作る（IDはrehype-slug由来）。 */
export function extractToc(html: string): TocItem[] {
  const items: TocItem[] = [];
  const re = /<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const depth = Number(m[1]) as 2 | 3;
    const text = m[3].replace(/<[^>]+>/g, '').trim();
    if (text) items.push({ id: m[2], text, depth });
  }
  return items;
}
