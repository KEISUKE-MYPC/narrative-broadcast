import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractStrength, formatDelta } from './publish';
import { generateArticle } from './generate';

// 記事のslugから銘柄キー（末尾の -btc / -eth …）を取る
function keyFromSlug(slug: string): string {
  const m = slug.match(/-([a-z0-9]+)$/);
  return m ? m[1] : '';
}

type RowRef = { idx: number; cells: string[]; slug: string; key: string; strength: number; delta: string };

// INDEXのデータ行を抽出（ヘッダ・区切り・非テーブル行は除外）
function dataRows(lines: string[]): RowRef[] {
  const out: RowRef[] = [];
  lines.forEach((line, idx) => {
    const t = line.trim();
    if (!t.startsWith('|')) return;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 6) return;
    if (cells[0].startsWith('配信日時')) return;
    if (/^-+$/.test(cells[0].replace(/\s/g, ''))) return;
    const link = cells[5].match(/\(([^)]+)\)/);
    const sm = cells[3].match(/(\d+)\s*\/\s*10/);
    if (!link || !sm) return;
    const slug = link[1].replace(/\.md$/, '');
    out.push({ idx, cells, slug, key: keyFromSlug(slug), strength: Number(sm[1]), delta: '±0' });
  });
  return out;
}

/**
 * INDEX.md の強度列を strengthBySlug で差し替え、銘柄ごとに時系列でdeltaを再計算して返す（純粋）。
 * - mapに無いslugは現状の強度を保持する。
 * - 強度以外のセル・ヘッダ・区切り・非テーブル行は保持する。
 */
export function recomputeIndex(indexMd: string, strengthBySlug: Map<string, number>): string {
  const lines = indexMd.split('\n');
  const rows = dataRows(lines);

  // 最終強度を確定
  for (const r of rows) r.strength = strengthBySlug.get(r.slug) ?? r.strength;

  // 銘柄ごとにdelta再計算。ファイルは新しい順なので、各銘柄を逆順(古→新)で処理。
  const byKey = new Map<string, RowRef[]>();
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key)!.push(r);
  }
  for (const group of byKey.values()) {
    let prev: number | null = null;
    for (const r of [...group].reverse()) { // 古→新
      r.delta = formatDelta(r.strength, prev);
      prev = r.strength;
    }
  }

  // 行を書き戻す（強度セルのみ変更、他は保持）
  for (const r of rows) {
    r.cells[3] = `${r.strength}/10 (${r.delta})`;
    lines[r.idx] = `| ${r.cells.join(' | ')} |`;
  }
  return lines.join('\n');
}

export function buildJudgePrompt(articleMd: string): string {
  return `次は暗号資産のナラティブ分析記事です。この記事が示す「ナラティブ強度」を1〜10の整数で評価してください。
強度＝支配的ナラティブが言説・ポジション・オンチェーンの各層をどれだけ束ね共振させているか。10=全層が単一の物語に強く共振、5=部分的に共振、1=物語が不在で各層がバラバラ。
出力は「ナラティブ強度：N/10」の1行のみ（説明・前置き不要）。

---
${articleMd.slice(0, 6000)}`;
}

export async function judgeStrength(
  articleMd: string,
  opts: { apiKey: string },
): Promise<number | null> {
  const out = await generateArticle(buildJudgePrompt(articleMd), { apiKey: opts.apiKey, think: false });
  return extractStrength(out);
}

async function main() {
  const root = process.cwd();
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) throw new Error('OLLAMA_API_KEY missing');
  const dryRun = process.argv.includes('--dry-run');

  const indexPath = join(root, 'articles', 'INDEX.md');
  const indexMd = readFileSync(indexPath, 'utf8');
  const rows = dataRows(indexMd.split('\n'));
  // 現状1/10（バグで固定された行）だけを判定対象にする。既に実値の行は触らない。
  const targets = rows.filter((r) => r.strength === 1);
  console.log(`[backfill] total=${rows.length} targets(strength=1)=${targets.length}`);

  const map = new Map<string, number>();
  let done = 0;
  for (const r of targets) {
    const articlePath = join(root, 'articles', `${r.slug}.md`);
    try {
      const md = readFileSync(articlePath, 'utf8');
      const s = await judgeStrength(md, { apiKey });
      if (s != null) {
        map.set(r.slug, s);
        console.log(`[backfill] ${++done}/${targets.length} ${r.slug} -> ${s}`);
      } else {
        console.warn(`[backfill] ${++done}/${targets.length} ${r.slug} -> 判定不能(据え置き)`);
      }
    } catch (e) {
      console.warn(`[backfill] ${++done}/${targets.length} ${r.slug} -> ${(e as Error).message}(据え置き)`);
    }
  }

  const next = recomputeIndex(indexMd, map);
  if (dryRun) {
    console.log(`[backfill] dry-run: judged=${map.size}。書き込みはしない。`);
    return;
  }
  writeFileSync(indexPath, next, 'utf8');
  console.log(`[backfill] INDEX.md 更新完了（judged=${map.size}）`);
}

if (process.argv[1] && process.argv[1].endsWith('backfill-strength.ts')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
