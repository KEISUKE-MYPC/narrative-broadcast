import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';

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
    .use(rehypeStringify)
    .process(stripAutoNotice(content));
  return String(file);
}
