import { writeFileSync } from 'node:fs';
import type { IndexRow } from '../../lib/index-parser';
import { getIndexRows } from '../../lib/index-parser';
import { getArticleBySlug } from '../../lib/articles';
import { appendDataTable } from '../data-table';
import { generateArticle } from '../generate';
import { datetimeJst } from '../publish';
import { collectWeek } from './collect-week';
import { buildWeeklyTable } from './weekly-data-table';
import { buildWeeklyPrompt } from './build-weekly-prompt';
import { publishWeekly } from './publish-weekly';

export type RunWeeklyDeps = {
  rows: IndexRow[];
  getArticle: (slug: string) => string | null;
  generate: (prompt: string) => Promise<string>;
  publish: (opts: {
    markdown: string; keyData: string; compositeStrength: number; now: Date; root: string;
  }) => { path: string; skipped: boolean };
  root?: string;
};

export async function runWeekly(
  now: Date,
  deps: RunWeeklyDeps,
): Promise<{ path: string; skipped: boolean }> {
  const week = collectWeek(now, { rows: deps.rows, getArticle: deps.getArticle });
  const prompt = buildWeeklyPrompt(week, datetimeJst(now));
  const raw = await deps.generate(prompt);
  const markdown = appendDataTable(raw, buildWeeklyTable(week)); // 免責文の直前に差し込み
  const keyData =
    `合成強度${week.compositeStrength}/10・${week.assets.length}銘柄・${week.weekStart}〜${week.weekEnd}`;
  return deps.publish({
    markdown, keyData, compositeStrength: week.compositeStrength,
    now, root: deps.root ?? process.cwd(),
  });
}

// CLI: npx tsx pipeline/weekly/run-weekly.ts [--no-publish]
async function main() {
  const noPublish = process.argv.includes('--no-publish');
  const now = new Date();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  if (noPublish) {
    const week = collectWeek(now, { rows: getIndexRows(), getArticle: (s) => getArticleBySlug(s)?.raw ?? null });
    const prompt = buildWeeklyPrompt(week, datetimeJst(now));
    const raw = await generateArticle(prompt, { apiKey });
    const markdown = appendDataTable(raw, buildWeeklyTable(week));
    const out = '/tmp/weekly-dryrun.md';
    writeFileSync(out, markdown, 'utf8');
    console.log(`[weekly] dry-run -> ${out}`);
    return;
  }

  const res = await runWeekly(now, {
    rows: getIndexRows(),
    getArticle: (s) => getArticleBySlug(s)?.raw ?? null,
    generate: (p) => generateArticle(p, { apiKey }),
    publish: publishWeekly,
  });
  console.log(`[weekly] ${res.skipped ? 'skipped' : 'published'} ${res.path}`);
}

// CLI実行時のみ main を呼ぶ（テストimport時は呼ばない）
if (process.argv[1] && process.argv[1].endsWith('run-weekly.ts')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
