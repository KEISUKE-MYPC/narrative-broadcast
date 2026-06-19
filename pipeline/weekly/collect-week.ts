import type { IndexRow } from '../../lib/index-parser';
import { categoryFromSlug } from '../../lib/categories';

const ASSETS = ['btc', 'eth', 'xrp', 'sol'];

export type WeekArticle = {
  slug: string;
  asset: string;
  datetime: string;
  title: string;
  strength: number;
  dashboard: Record<string, string>;
};

export type AssetWeek = {
  asset: string;
  count: number;
  first: WeekArticle; // 週初
  last: WeekArticle;  // 週末
};

export type WeekData = {
  weekStart: string; // 'YYYY-MM-DD'(JST)
  weekEnd: string;   // 'YYYY-MM-DD'(JST)
  assets: AssetWeek[];
  missing: string[]; // 記事が無かった銘柄
  compositeStrength: number; // 週末強度の平均（四捨五入1〜10）
};

// now の属する週の月曜00:00 JST を UTC Date で返す
export function weekStartJst(now: Date, tz = 'Asia/Tokyo'): Date {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) if (part.type !== 'literal') p[part.type] = part.value;
  const backMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const back = backMap[p.weekday] ?? 0;
  // 今日のJST 00:00 を UTC epoch に（JSTはUTC+9）
  const todayMidnightUtc = Date.UTC(+p.year, +p.month - 1, +p.day, 0, 0, 0) - 9 * 3600 * 1000;
  return new Date(todayMidnightUtc - back * 24 * 3600 * 1000);
}

// 'YYYY-MM-DD HH:MM'(JST) → UTC Date
export function parseJstDatetime(s: string): Date {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return new Date(NaN);
  const [, y, mo, d, h, mi] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi) - 9 * 3600 * 1000);
}

// JST 'YYYY-MM-DD' 文字列
function jstDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

// 「## 実データ計器盤」のテーブルをラベル→値Recordに
export function parseDashboard(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (cells[0] === '指標' || /^-+$/.test(cells[0].replace(/\s/g, ''))) continue;
    out[cells[0]] = cells[1];
  }
  return out;
}

// '$64,338（…）' → 64338
export function extractPrice(value: string): number | null {
  const m = value.match(/\$([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// row の銘柄キー（btc/eth/xrp/sol）。weekly等は null。
function assetOf(slug: string): string | null {
  const c = categoryFromSlug(slug).slug;
  return ASSETS.includes(c) ? c : null;
}

// 今週（月曜00:00〜now）かつ銘柄記事のみ
export function selectWeekArticles(rows: IndexRow[], now: Date): IndexRow[] {
  const start = weekStartJst(now).getTime();
  const end = now.getTime();
  return rows.filter((r) => {
    if (!assetOf(r.slug)) return false;
    const t = parseJstDatetime(r.datetime).getTime();
    return Number.isFinite(t) && t >= start && t <= end;
  });
}

export function collectWeek(
  now: Date,
  deps: { rows: IndexRow[]; getArticle: (slug: string) => string | null },
): WeekData {
  const start = weekStartJst(now);
  const selected = selectWeekArticles(deps.rows, now);

  const byAsset = new Map<string, WeekArticle[]>();
  for (const r of selected) {
    const asset = assetOf(r.slug)!;
    const md = deps.getArticle(r.slug) ?? '';
    const wa: WeekArticle = {
      slug: r.slug, asset, datetime: r.datetime,
      title: r.narrative, strength: r.strength, dashboard: parseDashboard(md),
    };
    const arr = byAsset.get(asset) ?? [];
    arr.push(wa);
    byAsset.set(asset, arr);
  }

  const assets: AssetWeek[] = [];
  for (const asset of ASSETS) {
    const arr = byAsset.get(asset);
    if (!arr || !arr.length) continue;
    // 時系列昇順（古い→新しい）
    arr.sort((a, b) => parseJstDatetime(a.datetime).getTime() - parseJstDatetime(b.datetime).getTime());
    assets.push({ asset, count: arr.length, first: arr[0], last: arr[arr.length - 1] });
  }

  const missing = ASSETS.filter((a) => !byAsset.has(a));
  const ends = assets.map((a) => a.last.strength);
  const compositeStrength = ends.length
    ? Math.min(10, Math.max(1, Math.round(ends.reduce((s, n) => s + n, 0) / ends.length)))
    : 5;

  return {
    weekStart: jstDate(start),
    weekEnd: jstDate(now),
    assets, missing, compositeStrength,
  };
}
