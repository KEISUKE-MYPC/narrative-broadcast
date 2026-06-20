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

export function articleRelPath(cfg: { outputDir: string; cycle: string; key: string }, now: Date, tz = 'Asia/Tokyo'): string {
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

// 記事本文からLLMが付けたナラティブ強度(1〜10)を抽出する。無ければ null。
// 例: 「**ナラティブ強度：7/10**」/「ナラティブ強度: 7 / 10」など表記揺れを許容。
export function extractStrength(md: string): number | null {
  const m = md.match(/ナラティブ強度[\s:：*]*(\d+)\s*[/／]\s*10/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, n));
}

// INDEX.md から同一銘柄(keyの接尾辞)の直近行の強度を引く。無ければ null。
// INDEXは新しい順で最新行が先頭側にあるため、最初に一致した行が「前回」。
export function previousStrength(indexMd: string, key: string): number | null {
  const suffix = new RegExp(`-${key}\\.md$`);
  for (const line of indexMd.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 6) continue;
    const link = cells[5].match(/\(([^)]+)\)/);
    if (!link || !suffix.test(link[1])) continue;
    const sm = cells[3].match(/(\d+)\s*\/\s*10/);
    if (sm) return Number(sm[1]);
  }
  return null;
}

// 前回比の表記（+2 / -1 / ±0）
export function formatDelta(cur: number, prev: number | null): string {
  if (prev == null) return '±0';
  const d = cur - prev;
  if (d === 0) return '±0';
  return d > 0 ? `+${d}` : `${d}`;
}

export function buildIndexRow(o: {
  datetimeJst: string; cycle: string; title: string;
  strength: number; strengthDelta: string; keyData: string; slug: string;
}): string {
  return `| ${o.datetimeJst} | ${o.cycle} | ${o.title} | ${o.strength}/10 (${o.strengthDelta}) | ${o.keyData} | [link](${o.slug}.md) |`;
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
  // 強度はLLM判定値を採用。抽出失敗時は前回値を据え置き（無ければ中立5）。
  const prev = previousStrength(indexMd, opts.cfg.key);
  const strength = extractStrength(opts.markdown) ?? prev ?? 5;
  const row = buildIndexRow({
    datetimeJst: datetimeJst(opts.now), cycle: opts.cfg.cycle,
    title: extractTitle(opts.markdown),
    strength, strengthDelta: formatDelta(strength, prev),
    keyData: opts.keyData,
    slug: relToSlug(rel, opts.cfg.outputDir),
  });
  writeFileSync(indexPath, insertIndexRow(indexMd, row), 'utf8');
  return { path: rel, skipped: false };
}
