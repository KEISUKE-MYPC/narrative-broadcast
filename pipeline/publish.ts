import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { AssetConfig } from './types';

// Intl で JST の各パートを得る
function jstParts(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) if (part.type !== 'literal') p[part.type] = part.value;
  return p; // {year,month,day,hour,minute}
}

export function articleRelPath(cfg: AssetConfig, now: Date, tz = 'Asia/Tokyo'): string {
  const p = jstParts(now, tz);
  const name = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}-${cfg.cycle}-${cfg.key}.md`;
  return `${cfg.outputDir}/${p.year}/${p.month}/${name}`;
}

export function datetimeJst(now: Date, tz = 'Asia/Tokyo'): string {
  const p = jstParts(now, tz);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function extractTitle(md: string): string {
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (t.startsWith('# ')) return t.slice(2).trim();
  }
  return '(無題)';
}

// articles/2026/06/x.md -> 2026/06/x  （INDEXリンク・slug用）
export function relToSlug(rel: string, outputDir: string): string {
  return rel.replace(`${outputDir}/`, '').replace(/\.md$/, '');
}

export function buildIndexRow(o: {
  datetimeJst: string; cycle: string; title: string; keyData: string; slug: string;
}): string {
  return `| ${o.datetimeJst} | ${o.cycle} | ${o.title} | 1/10 (±0) | ${o.keyData} | [link](${o.slug}.md) |`;
}

// INDEX.md のヘッダ区切り行直後（最新行の位置）に row を挿入
export function insertIndexRow(indexMd: string, row: string): string {
  const lines = indexMd.split('\n');
  const sepIdx = lines.findIndex((l) => /^\|[-\s|]+\|$/.test(l.trim()));
  if (sepIdx === -1) return indexMd.trimEnd() + '\n' + row + '\n';
  lines.splice(sepIdx + 1, 0, row);
  return lines.join('\n');
}

export function publish(opts: {
  cfg: AssetConfig; markdown: string; keyData: string; now: Date; root: string;
}): { path: string; skipped: boolean } {
  const rel = articleRelPath(opts.cfg, opts.now);
  const abs = join(opts.root, rel);
  if (existsSync(abs)) return { path: rel, skipped: true };
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, opts.markdown, 'utf8');

  const indexPath = join(opts.root, opts.cfg.outputDir, 'INDEX.md');
  const indexMd = readFileSync(indexPath, 'utf8');
  const row = buildIndexRow({
    datetimeJst: datetimeJst(opts.now), cycle: opts.cfg.cycle,
    title: extractTitle(opts.markdown), keyData: opts.keyData,
    slug: relToSlug(rel, opts.cfg.outputDir),
  });
  writeFileSync(indexPath, insertIndexRow(indexMd, row), 'utf8');
  return { path: rel, skipped: false };
}
