import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  articleRelPath, datetimeJst, extractTitle, relToSlug,
  buildIndexRow, insertIndexRow, previousStrength, formatDelta,
} from '../publish';

// 週次の擬似config（接尾辞 -weekly / サイクル 7d）
const WEEKLY_REF = { outputDir: 'articles', cycle: '7d', key: 'weekly' };

/** 横断記事を保存し、INDEX.md に合成強度の行を1件追加する。 */
export function publishWeekly(opts: {
  markdown: string; keyData: string; compositeStrength: number; now: Date; root: string;
}): { path: string; skipped: boolean } {
  const rel = articleRelPath(WEEKLY_REF, opts.now);
  const abs = join(opts.root, rel);
  if (existsSync(abs)) return { path: rel, skipped: true };
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, opts.markdown, 'utf8');

  const indexPath = join(opts.root, WEEKLY_REF.outputDir, 'INDEX.md');
  const indexMd = readFileSync(indexPath, 'utf8');
  const prev = previousStrength(indexMd, 'weekly');
  const strength = opts.compositeStrength; // 合成強度は決定論的に算出済み
  const row = buildIndexRow({
    datetimeJst: datetimeJst(opts.now), cycle: '7d',
    title: extractTitle(opts.markdown),
    strength, strengthDelta: formatDelta(strength, prev),
    keyData: opts.keyData, slug: relToSlug(rel, WEEKLY_REF.outputDir),
  });
  writeFileSync(indexPath, insertIndexRow(indexMd, row), 'utf8');
  return { path: rel, skipped: false };
}
