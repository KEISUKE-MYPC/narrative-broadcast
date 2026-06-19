import type { WeekData, AssetWeek } from './collect-week';
import { extractPrice } from './collect-week';

const LABEL: Record<string, string> = { btc: 'BTC', eth: 'ETH', xrp: 'XRP', sol: 'SOL' };
const ALL = ['btc', 'eth', 'xrp', 'sol'];

function priceWow(a: AssetWeek): string {
  const p0 = extractPrice(a.first.dashboard['価格'] ?? '');
  const p1 = extractPrice(a.last.dashboard['価格'] ?? '');
  if (p0 == null || p1 == null || p0 === 0) return 'N/A';
  const pct = ((p1 - p0) / p0) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

// 週初→週末で消えた/現れたトレンド語を要約
function trendShift(a: AssetWeek): string {
  const split = (s?: string) => (s ? s.split('、').map((x) => x.trim()).filter(Boolean) : []);
  const t0 = new Set(split(a.first.dashboard['トレンド語']));
  const t1 = split(a.last.dashboard['トレンド語']);
  const added = t1.filter((w) => !t0.has(w)).slice(0, 4);
  return added.length ? `新規: ${added.join('、')}` : '変化小';
}

/** WeekData から「週間計器盤（W/W）」テーブルを生成。 */
export function buildWeeklyTable(week: WeekData): string {
  const rows: string[] = [];
  for (const asset of ALL) {
    const a = week.assets.find((x) => x.asset === asset);
    if (!a) {
      rows.push(`| ${LABEL[asset]} | 記事なし | — | — | — |`);
      continue;
    }
    rows.push(
      `| ${LABEL[asset]} | ${a.first.strength}→${a.last.strength} | ${priceWow(a)} | ${a.count}本 | ${trendShift(a)} |`,
    );
  }
  return [
    '## 週間計器盤（W/W）',
    '',
    `今週（${week.weekStart}〜${week.weekEnd} JST）の各銘柄の週初→週末。記事内計器盤から導出。`,
    '',
    '| 銘柄 | 強度W/W | 価格W/W | 記事数 | トレンド語の変化 |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}
