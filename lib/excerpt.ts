import { getArticleBySlug } from './articles';
import { SITE_DESCRIPTION } from './seo';

function stripMarkdown(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '$1')              // インラインコード
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // 太字
    .replace(/\*([^*]+)\*/g, '$1')            // 強調
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // リンク
    .replace(/\s+/g, ' ')
    .trim();
}

// raw本文から最初の実段落を抽出して整形する純粋関数
export function extractDescription(raw: string, maxLen = 150): string {
  let para = '';
  for (const line of raw.split('\n').map((l) => l.trim())) {
    if (!line) continue;
    if (line.startsWith('#')) continue;       // 見出し
    if (line.startsWith('>')) continue;       // 引用
    if (line.startsWith('|')) continue;       // 表
    if (line.startsWith('<!--')) continue;    // コメント
    if (line.startsWith('※')) continue;       // 注釈・出典注記
    if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) continue; // リスト
    para = line;
    break;
  }
  if (!para) return '';
  const clean = stripMarkdown(para);
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen) + '…';
}

// スラッグからdescriptionを得る（抽出失敗時はサイトdescription）
export function getArticleDescription(slug: string, maxLen = 150): string {
  const article = getArticleBySlug(slug);
  if (!article) return SITE_DESCRIPTION;
  return extractDescription(article.raw, maxLen) || SITE_DESCRIPTION;
}
