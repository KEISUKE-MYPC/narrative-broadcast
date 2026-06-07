import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type IndexRow = {
  datetime: string;
  cycle: string;
  narrative: string;
  strength: number;
  strengthDelta: string;
  keyData: string;
  slug: string;
};

const ARTICLES_DIR = join(process.cwd(), 'articles');

export function parseIndex(markdown: string): IndexRow[] {
  const rows: IndexRow[] = [];
  for (const line of markdown.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 6) continue;
    if (cells[0].startsWith('配信日時')) continue; // ヘッダ
    if (/^-+$/.test(cells[0].replace(/\s/g, ''))) continue; // 区切り
    const strengthMatch = cells[3].match(/(\d+)\s*\/\s*10\s*\(([^)]*)\)/);
    const linkMatch = cells[5].match(/\(([^)]+)\)/);
    if (!strengthMatch || !linkMatch) continue;
    rows.push({
      datetime: cells[0],
      cycle: cells[1],
      narrative: cells[2],
      strength: Number(strengthMatch[1]),
      strengthDelta: strengthMatch[2].trim(),
      keyData: cells[4],
      slug: linkMatch[1].replace(/\.md$/, ''),
    });
  }
  return rows;
}

export function getIndexRows(): IndexRow[] {
  return parseIndex(readFileSync(join(ARTICLES_DIR, 'INDEX.md'), 'utf8'));
}

/** slug から INDEX 行（タイトル・強度・日時等）を引く。無ければ null。 */
export function getIndexRowBySlug(slug: string): IndexRow | null {
  return getIndexRows().find((r) => r.slug === slug) ?? null;
}
