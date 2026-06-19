# 週次メタナラティブ統合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 週1回（日曜21:00 JST）、その週の全銘柄6h記事を入力に、BTC/ETH/SOL/XRP 横断のメタナラティブ統合記事を1本、完全自動で生成・公開する。

**Architecture:** 既存6hパイプライン（`pipeline/run.ts`）とは別系統の `pipeline/weekly/` を新設。今週の記事mdを `lib/index-parser` と `lib/articles` 経由で収集・パースし、記事内の「実データ計器盤」からW/W差分を導出（新規fetchゼロ）。LLM生成は既存 `pipeline/generate.ts` を再利用、公開は `pipeline/publish.ts` のヘルパーを再利用。サイト側は `lib/categories.ts` に weekly カテゴリを1件足すだけで `/c/weekly`・フィード・sitemap が自動で機能する。

**Tech Stack:** TypeScript / Node 24 / vitest / GitHub Actions（workflow_dispatch、発火は外部cron）/ Gemini API（既存 generate）。

## Global Constraints

- 言語・コメントは日本語。HTML/CSS/VanillaJS方針（本タスクはNext.js/TS既存資産の範囲）。
- 記事に価格予想・売買助言を書かない（6hと同じ規律。プロンプトで明示）。
- INDEX.md は 6h 公開ジョブと同じファイル。GitHub Actions の `concurrency.group` を `publish-btc` と共有して衝突回避。
- ファイル命名は既存規約に従う：`YYYY-MM-DD-HHMM-<cycle>-<key>.md`。週次は cycle=`7d` / key=`weekly` → 接尾辞 `-weekly`。
- 合成強度＝週末時点の各銘柄最新強度の平均（四捨五入で1〜10）。前週比は前週の weekly 行との差。
- テストは vitest。実行は `npx vitest run <path>`。型チェックは `npx tsc --noEmit`。
- 銘柄キー一覧は `['btc','eth','xrp','sol']`。

---

## File Structure

| ファイル | 責務 |
|---|---|
| `lib/categories.ts`（修正） | weekly カテゴリ追加 ＋ `metaCategory` フラグ |
| `app/page.tsx`（修正） | 強度チャート系列から metaCategory を除外 |
| `pipeline/publish.ts`（修正） | `articleRelPath` の引数型を構造的サブセットに緩和（6h呼び出しは無変更で通る） |
| `pipeline/weekly/collect-week.ts`（新規） | 週境界判定・今週記事の選別・計器盤パース・W/W集計 |
| `pipeline/weekly/weekly-data-table.ts`（新規） | 週間計器盤（W/W差分テーブル）の組み立て |
| `pipeline/weekly/build-weekly-prompt.ts`（新規） | 週次統合プロンプト生成 |
| `pipeline/weekly/publish-weekly.ts`（新規） | 横断記事の保存＋INDEX行追加（publishヘルパー再利用） |
| `pipeline/weekly/run-weekly.ts`（新規） | CLI：収集→生成→計器盤付与→公開（`--no-publish`対応） |
| `.github/workflows/publish-weekly.yml`（新規） | 週次ワークフロー（workflow_dispatch） |
| 各 `*.test.ts`（新規） | 上記の単体テスト |

---

## Task 1: weekly カテゴリ登録とチャート除外

**Files:**
- Modify: `lib/categories.ts`
- Modify: `app/page.tsx`
- Test: `lib/categories.weekly.test.ts`（新規）

**Interfaces:**
- Produces: `Category` 型に `metaCategory?: boolean` を追加。`CATEGORIES` に `slug:'weekly'` の1件を追加。`categoryFromSlug('…-7d-weekly')` が weekly を返す。

- [ ] **Step 1: 失敗するテストを書く**

`lib/categories.weekly.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryFromSlug, getCategory } from './categories';

describe('weekly カテゴリ', () => {
  it('weekly が登録され metaCategory フラグを持つ', () => {
    const weekly = CATEGORIES.find((c) => c.slug === 'weekly');
    expect(weekly).toBeTruthy();
    expect(weekly!.metaCategory).toBe(true);
    expect(weekly!.short).toBe('週次');
  });

  it('-7d-weekly 接尾辞の slug を weekly に解決する', () => {
    expect(categoryFromSlug('2026/06/2026-06-21-2100-7d-weekly').slug).toBe('weekly');
  });

  it('getCategory("weekly") が weekly を返す', () => {
    expect(getCategory('weekly').slug).toBe('weekly');
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run lib/categories.weekly.test.ts`
Expected: FAIL（weekly 未登録 / `metaCategory` 未定義）

- [ ] **Step 3: Category 型に metaCategory を追加**

`lib/categories.ts` の `Category` 型に1行追加：

```ts
  brandGradient?: [string, string]; // 線をグラデにする場合の[開始,終了]（例: SOLの紫→緑）
  metaCategory?: boolean; // 横断メタカテゴリ（銘柄別強度チャートから除外する）
};
```

- [ ] **Step 4: CATEGORIES に weekly を追加**

`lib/categories.ts` の `CATEGORIES` 配列末尾（sol の後）に追加：

```ts
  {
    slug: 'weekly',
    label: '週次メタナラティブ',
    short: '週次',
    description: '市場全体の語りを横断的に統合する週次レポート',
    symbol: '◴',
    accent: 'var(--accent)',
    ogAccent: '#d9a441', // 横断レポート用のアンバー
    brand: '#E0B341', // フィード/タブ用のアンバー実hex
    metaCategory: true,
  },
```

- [ ] **Step 5: 強度チャートから metaCategory を除外**

`app/page.tsx` の `series` 生成を、CATEGORIES を metaCategory で絞ってから map するよう変更：

```tsx
  const series: ChartSeries[] = CATEGORIES.filter((c) => !c.metaCategory).map((c) => ({
    slug: c.slug,
    short: c.short,
    label: c.label,
    color: c.brand,
    gradient: c.brandGradient,
    points: rows
      .filter((r) => categoryFromSlug(r.slug).slug === c.slug)
      .map((r) => ({ datetime: r.datetime, strength: r.strength, narrative: r.narrative })),
  })).filter((s) => s.points.length > 0);
```

- [ ] **Step 6: テストと型チェックと本番ビルドを確認**

Run: `npx vitest run lib/categories.weekly.test.ts && npx tsc --noEmit && npm run build`
Expected: テストPASS／型エラー無し／ビルド成功（`/c/weekly` ルートが生成されること。weekly記事はまだ無いので一覧は空でよい）

- [ ] **Step 7: コミット**

```bash
git add lib/categories.ts lib/categories.weekly.test.ts app/page.tsx
git commit -m "feat(weekly): weeklyカテゴリを登録しチャートから除外"
```

---

## Task 2: 週次データ収集（collect-week）

**Files:**
- Create: `pipeline/weekly/collect-week.ts`
- Test: `pipeline/weekly/collect-week.test.ts`

**Interfaces:**
- Consumes: `IndexRow`（`lib/index-parser`）。
- Produces:
  - `weekStartJst(now: Date, tz?: string): Date`
  - `parseJstDatetime(s: string): Date`
  - `parseDashboard(md: string): Record<string, string>`
  - `extractPrice(value: string): number | null`
  - `selectWeekArticles(rows: IndexRow[], now: Date): IndexRow[]`
  - `collectWeek(now: Date, deps: { rows: IndexRow[]; getArticle: (slug: string) => string | null }): WeekData`
  - 型 `WeekArticle`, `AssetWeek`, `WeekData`（下記実装どおり）

- [ ] **Step 1: 失敗するテストを書く**

`pipeline/weekly/collect-week.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  weekStartJst, parseJstDatetime, parseDashboard, extractPrice,
  selectWeekArticles, collectWeek,
} from './collect-week';
import type { IndexRow } from '../../lib/index-parser';

const dash = (price: string, trend: string) => `# タイトル
**ナラティブ強度：3/10**
本文。

## 実データ計器盤（出典）

| 指標 | 実測値 | ソース |
|---|---|---|
| 価格 | ${price} | CoinGecko |
| トレンド語 | ${trend} | Santiment |

※本記事は情報提供を目的としたものであり、投資助言ではありません。
`;

const row = (datetime: string, slug: string, strength: number): IndexRow => ({
  datetime, cycle: '6h', narrative: 'n', strength, strengthDelta: '±0',
  keyData: 'k', slug,
});

describe('weekStartJst', () => {
  it('日曜の now からその週の月曜00:00 JST を返す', () => {
    // 2026-06-21 は日曜。21:00 JST = 12:00 UTC。
    const now = new Date('2026-06-21T12:00:00Z');
    const mon = weekStartJst(now);
    // 月曜 2026-06-15 00:00 JST = 2026-06-14 15:00 UTC
    expect(mon.toISOString()).toBe('2026-06-14T15:00:00.000Z');
  });
});

describe('parseJstDatetime', () => {
  it('JST文字列をUTC Dateに変換する', () => {
    expect(parseJstDatetime('2026-06-15 00:00').toISOString()).toBe('2026-06-14T15:00:00.000Z');
  });
});

describe('parseDashboard / extractPrice', () => {
  it('計器盤をラベル→値に分解し価格を数値化する', () => {
    const d = parseDashboard(dash('$64,338（24h -2.74% / 7d 11.03% / 30d -15.66%）', 'fed、fomc'));
    expect(d['価格']).toContain('$64,338');
    expect(d['トレンド語']).toBe('fed、fomc');
    expect(extractPrice(d['価格'])).toBe(64338);
  });
});

describe('selectWeekArticles', () => {
  it('今週かつ銘柄記事だけを選ぶ（先週・weeklyは除外）', () => {
    const now = new Date('2026-06-21T12:00:00Z'); // 週=6/15〜
    const rows = [
      row('2026-06-20 12:00', '2026/06/2026-06-20-1200-6h-btc', 4),
      row('2026-06-14 12:00', '2026/06/2026-06-14-1200-6h-btc', 9), // 先週→除外
      row('2026-06-21 00:00', '2026/06/2026-06-21-0000-7d-weekly', 5), // weekly→除外
    ];
    const sel = selectWeekArticles(rows, now);
    expect(sel.map((r) => r.slug)).toEqual(['2026/06/2026-06-20-1200-6h-btc']);
  });
});

describe('collectWeek', () => {
  it('銘柄ごとに週初/週末を取り、合成強度を平均で出す', () => {
    const now = new Date('2026-06-21T12:00:00Z');
    const rows = [
      row('2026-06-20 12:00', '2026/06/2026-06-20-1200-6h-btc', 4), // BTC 週末
      row('2026-06-16 06:00', '2026/06/2026-06-16-0600-6h-btc', 2), // BTC 週初
      row('2026-06-19 18:00', '2026/06/2026-06-19-1800-6h-eth', 6), // ETH 1本のみ
    ];
    const getArticle = (slug: string) =>
      slug.endsWith('-btc') || slug.includes('-btc') ? dash('$64,000', 'fed') : dash('$1,700', 'eth');
    const wk = collectWeek(now, { rows, getArticle });
    expect(wk.weekStart).toBe('2026-06-15');
    const btc = wk.assets.find((a) => a.asset === 'btc')!;
    expect(btc.first.strength).toBe(2);
    expect(btc.last.strength).toBe(4);
    expect(btc.count).toBe(2);
    expect(wk.missing.sort()).toEqual(['sol', 'xrp']);
    // 合成強度＝(BTC4 + ETH6)/2 = 5
    expect(wk.compositeStrength).toBe(5);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run pipeline/weekly/collect-week.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: collect-week.ts を実装**

`pipeline/weekly/collect-week.ts`:

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run pipeline/weekly/collect-week.test.ts`
Expected: PASS（全ケース）

- [ ] **Step 5: コミット**

```bash
git add pipeline/weekly/collect-week.ts pipeline/weekly/collect-week.test.ts
git commit -m "feat(weekly): 今週記事の収集とW/W集計を実装"
```

---

## Task 3: 週間計器盤テーブル（weekly-data-table）

**Files:**
- Create: `pipeline/weekly/weekly-data-table.ts`
- Test: `pipeline/weekly/weekly-data-table.test.ts`

**Interfaces:**
- Consumes: `WeekData`, `extractPrice`（Task 2）。
- Produces: `buildWeeklyTable(week: WeekData): string` — `## 週間計器盤（W/W）` セクションの markdown。

- [ ] **Step 1: 失敗するテストを書く**

`pipeline/weekly/weekly-data-table.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildWeeklyTable } from './weekly-data-table';
import type { WeekData } from './collect-week';

const wa = (datetime: string, strength: number, price: string, trend: string) => ({
  slug: 's', asset: 'btc', datetime, title: 't', strength,
  dashboard: { '価格': price, 'トレンド語': trend },
});

const week: WeekData = {
  weekStart: '2026-06-15', weekEnd: '2026-06-21',
  assets: [{
    asset: 'btc', count: 2,
    first: wa('2026-06-15 06:00', 2, '$60,000', 'fed、fomc'),
    last: wa('2026-06-20 12:00', 4, '$66,000', 'fed、etf'),
  }],
  missing: ['eth', 'xrp', 'sol'],
  compositeStrength: 4,
};

describe('buildWeeklyTable', () => {
  it('銘柄ごとにW/W差分行を出す', () => {
    const md = buildWeeklyTable(week);
    expect(md).toContain('## 週間計器盤（W/W）');
    expect(md).toContain('BTC');
    expect(md).toContain('2→4'); // 強度W/W
    expect(md).toContain('+10.00%'); // 価格W/W (60000→66000)
  });

  it('記事欠落銘柄を注記する', () => {
    const md = buildWeeklyTable(week);
    expect(md).toContain('ETH');
    expect(md).toContain('記事なし');
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run pipeline/weekly/weekly-data-table.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: weekly-data-table.ts を実装**

`pipeline/weekly/weekly-data-table.ts`:

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run pipeline/weekly/weekly-data-table.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add pipeline/weekly/weekly-data-table.ts pipeline/weekly/weekly-data-table.test.ts
git commit -m "feat(weekly): 週間計器盤(W/W)テーブルを実装"
```

---

## Task 4: 週次統合プロンプト（build-weekly-prompt）

**Files:**
- Create: `pipeline/weekly/build-weekly-prompt.ts`
- Test: `pipeline/weekly/build-weekly-prompt.test.ts`

**Interfaces:**
- Consumes: `WeekData`（Task 2）。
- Produces: `buildWeeklyPrompt(week: WeekData, datetimeJst: string): string`。

- [ ] **Step 1: 失敗するテストを書く**

`pipeline/weekly/build-weekly-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildWeeklyPrompt } from './build-weekly-prompt';
import type { WeekData } from './collect-week';

const wa = (datetime: string, strength: number, title: string) => ({
  slug: 's', asset: 'btc', datetime, title, strength, dashboard: { '価格': '$64,000' },
});

const week: WeekData = {
  weekStart: '2026-06-15', weekEnd: '2026-06-21',
  assets: [{
    asset: 'btc', count: 3,
    first: wa('2026-06-15 06:00', 2, 'BTCはマクロに同化'),
    last: wa('2026-06-20 12:00', 4, 'BTCに自律性が戻りつつある'),
  }],
  missing: ['eth', 'xrp', 'sol'],
  compositeStrength: 4,
};

describe('buildWeeklyPrompt', () => {
  it('合成強度・前週比指示・各銘柄の週初/週末ナラティブを含む', () => {
    const p = buildWeeklyPrompt(week, '2026-06-21 21:00');
    expect(p).toContain('合成強度');
    expect(p).toContain('4/10');
    expect(p).toContain('BTCはマクロに同化');
    expect(p).toContain('BTCに自律性が戻りつつある');
  });

  it('価格予想・売買助言の禁止を明示する', () => {
    const p = buildWeeklyPrompt(week, '2026-06-21 21:00');
    expect(p).toContain('価格予想');
    expect(p).toContain('禁止');
  });

  it('必須セクション（銘柄別ミニ表・伝染/ローテーション）を指示する', () => {
    const p = buildWeeklyPrompt(week, '2026-06-21 21:00');
    expect(p).toContain('銘柄別');
    expect(p).toContain('伝染');
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run pipeline/weekly/build-weekly-prompt.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: build-weekly-prompt.ts を実装**

`pipeline/weekly/build-weekly-prompt.ts`:

```ts
import type { WeekData } from './collect-week';

const LABEL: Record<string, string> = { btc: 'BTC', eth: 'ETH', xrp: 'XRP', sol: 'SOL' };

// 各銘柄の今週の語りの推移を素材としてダイジェスト化
function assetDigest(week: WeekData): string {
  const lines: string[] = [];
  for (const a of week.assets) {
    lines.push(
      `- ${LABEL[a.asset]}（${a.count}本）: ` +
      `週初「${a.first.title}」(強度${a.first.strength}) → ` +
      `週末「${a.last.title}」(強度${a.last.strength})`,
    );
  }
  if (week.missing.length) {
    lines.push(`- 記事なし: ${week.missing.map((m) => LABEL[m]).join('、')}`);
  }
  return lines.join('\n');
}

/** 週次メタナラティブ統合記事の生成プロンプト。 */
export function buildWeeklyPrompt(week: WeekData, datetimeJst: string): string {
  return `あなたはクリプト市場のナラティブ（言説）を構造分析するアナリストである。
以下は今週（${week.weekStart}〜${week.weekEnd} JST）に配信した、BTC/ETH/XRP/SOL の6h分析記事の要約である。
これらを横断し、「今週、市場全体の語りがどう動いたか」を1本のメタナラティブ統合記事にまとめよ。

## 今週の各銘柄の推移（素材）
${assetDigest(week)}

## 合成強度
今週末時点の市場全体の合成強度は ${week.compositeStrength}/10（4銘柄の週末強度の平均）。

## 出力要件（Markdown・日本語）
以下の構成・見出しで書くこと:
1. 「# 」見出しで、今週を貫いた統合メタナラティブを1行のタイトルに
2. 「**ナラティブ強度：${week.compositeStrength}/10**」の行（合成強度。前週比はサイトが付与するため数値のみ）
3. リード（2-3文）: 今週、市場の語りに何が起きたか
4. 「## 今週の支配的メタナラティブ」: 全銘柄を貫いた力学
5. 「## 銘柄別・週間スナップ」: BTC/ETH/XRP/SOL それぞれの週初→週末の語りの変化を簡潔に
6. 「## ナラティブの伝染・ローテーション」: 銘柄間で物語がどう移った/収斂したか
7. 「## 構造分析（週次）」: 表層/中層/深層 ＋ reflexivity を、今週の"変化"の観点で
8. 「## 今週の決定的変化点」: 3点
9. 「## 来週の観測ポイント」: 語りの分岐点
10. 末尾に「※本記事は情報提供を目的としたものであり、投資助言ではありません。」

## 厳守事項
- 価格予想・売買助言は禁止。認知の歪みや語りの構造を論じること。
- 数値は素材の範囲に忠実に。誇張しない。
- 配信日時: ${datetimeJst} JST。`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run pipeline/weekly/build-weekly-prompt.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add pipeline/weekly/build-weekly-prompt.ts pipeline/weekly/build-weekly-prompt.test.ts
git commit -m "feat(weekly): 週次統合プロンプトを実装"
```

---

## Task 5: 横断記事の公開（publish-weekly）

**Files:**
- Modify: `pipeline/publish.ts`（`articleRelPath` の引数型のみ緩和）
- Create: `pipeline/weekly/publish-weekly.ts`
- Test: `pipeline/weekly/publish-weekly.test.ts`

**Interfaces:**
- Consumes: `articleRelPath`, `datetimeJst`, `extractTitle`, `relToSlug`, `buildIndexRow`, `insertIndexRow`, `previousStrength`, `formatDelta`（`pipeline/publish.ts`）。
- Produces: `publishWeekly(opts: { markdown: string; keyData: string; compositeStrength: number; now: Date; root: string }): { path: string; skipped: boolean }`。

- [ ] **Step 1: articleRelPath の引数型を緩和**

`pipeline/publish.ts` の `articleRelPath` シグネチャを、フル `AssetConfig` から必要3フィールドの構造型に変更（6h呼び出し `articleRelPath(opts.cfg, opts.now)` は AssetConfig がこの型を満たすため無変更で通る）:

```ts
export function articleRelPath(
  cfg: { outputDir: string; cycle: string; key: string },
  now: Date, tz = 'Asia/Tokyo',
): string {
  const p = jstParts(now, tz);
  const name = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}-${cfg.cycle}-${cfg.key}.md`;
  return `${cfg.outputDir}/${p.year}/${p.month}/${name}`;
}
```

- [ ] **Step 2: 失敗するテストを書く**

`pipeline/weekly/publish-weekly.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { publishWeekly } from './publish-weekly';

let root: string;
const INDEX_HEADER = `# 配信インデックス

| 配信日時(JST) | サイクル | 支配的ナラティブ | 強度(前回比) | 主要データ | ファイル |
|---|---|---|---|---|---|
`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'weekly-'));
  mkdirSync(join(root, 'articles'), { recursive: true });
  writeFileSync(join(root, 'articles', 'INDEX.md'), INDEX_HEADER, 'utf8');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const md = `# 今週、マクロが全銘柄を飲み込んだ
**ナラティブ強度：5/10**
本文。
※本記事は情報提供を目的としたものであり、投資助言ではありません。
`;

describe('publishWeekly', () => {
  it('-7d-weekly.md を保存しINDEXに合成強度の行を足す', () => {
    const now = new Date('2026-06-21T12:00:00Z'); // 21:00 JST
    const res = publishWeekly({ markdown: md, keyData: '合成強度5/10', compositeStrength: 5, now, root });
    expect(res.skipped).toBe(false);
    expect(res.path).toMatch(/2026\/06\/2026-06-21-2100-7d-weekly\.md$/);
    const index = readFileSync(join(root, 'articles', 'INDEX.md'), 'utf8');
    expect(index).toContain('| 7d |');
    expect(index).toContain('5/10 (±0)');
    expect(index).toContain('今週、マクロが全銘柄を飲み込んだ');
  });

  it('前週のweekly行があれば前週比を出す', () => {
    const now = new Date('2026-06-21T12:00:00Z');
    publishWeekly({ markdown: md, keyData: 'k', compositeStrength: 5, now, root });
    // 翌週（+7d相当の別時刻）に強度7で公開
    const next = new Date('2026-06-28T12:00:00Z');
    const md7 = md.replace('5/10', '7/10');
    publishWeekly({ markdown: md7, keyData: 'k', compositeStrength: 7, now: next, root });
    const index = readFileSync(join(root, 'articles', 'INDEX.md'), 'utf8');
    expect(index).toContain('7/10 (+2)');
  });

  it('同一パスが既存ならスキップ', () => {
    const now = new Date('2026-06-21T12:00:00Z');
    publishWeekly({ markdown: md, keyData: 'k', compositeStrength: 5, now, root });
    const again = publishWeekly({ markdown: md, keyData: 'k', compositeStrength: 5, now, root });
    expect(again.skipped).toBe(true);
  });
});
```

- [ ] **Step 3: テストが落ちることを確認**

Run: `npx vitest run pipeline/weekly/publish-weekly.test.ts`
Expected: FAIL（publish-weekly 未作成）

- [ ] **Step 4: publish-weekly.ts を実装**

`pipeline/weekly/publish-weekly.ts`:

```ts
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

  const indexPath = join(opts.root, 'articles', 'INDEX.md');
  const indexMd = readFileSync(indexPath, 'utf8');
  const prev = previousStrength(indexMd, 'weekly');
  const strength = opts.compositeStrength; // 合成強度は決定論的に算出済み
  const row = buildIndexRow({
    datetimeJst: datetimeJst(opts.now), cycle: '7d',
    title: extractTitle(opts.markdown),
    strength, strengthDelta: formatDelta(strength, prev),
    keyData: opts.keyData, slug: relToSlug(rel, 'articles'),
  });
  writeFileSync(indexPath, insertIndexRow(indexMd, row), 'utf8');
  return { path: rel, skipped: false };
}
```

- [ ] **Step 5: テストと型チェックを確認**

Run: `npx vitest run pipeline/weekly/publish-weekly.test.ts pipeline/publish.test.ts && npx tsc --noEmit`
Expected: PASS（publish-weekly の全ケース＋既存 publish.test も緑）／型エラー無し

- [ ] **Step 6: コミット**

```bash
git add pipeline/publish.ts pipeline/weekly/publish-weekly.ts pipeline/weekly/publish-weekly.test.ts
git commit -m "feat(weekly): 横断記事の保存とINDEX追記を実装"
```

---

## Task 6: 実行エントリ（run-weekly）

**Files:**
- Create: `pipeline/weekly/run-weekly.ts`
- Test: `pipeline/weekly/run-weekly.test.ts`

**Interfaces:**
- Consumes: `collectWeek`（Task 2）, `buildWeeklyTable`（Task 3）, `buildWeeklyPrompt`（Task 4）, `publishWeekly`（Task 5）, `appendDataTable`（`pipeline/data-table.ts`）, `generateArticle`（`pipeline/generate.ts`）。
- Produces: `runWeekly(now: Date, deps: RunWeeklyDeps): Promise<{ path: string; skipped: boolean; dryRunPath?: string }>` と CLI `main()`。

- [ ] **Step 1: 失敗するテストを書く**

`pipeline/weekly/run-weekly.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runWeekly } from './run-weekly';
import type { IndexRow } from '../../lib/index-parser';

const row = (datetime: string, slug: string, strength: number): IndexRow => ({
  datetime, cycle: '6h', narrative: '語り', strength, strengthDelta: '±0', keyData: 'k', slug,
});

describe('runWeekly（依存注入・ドライラン）', () => {
  it('収集→生成→計器盤付与→公開を通す。生成プロンプトに合成強度が渡る', async () => {
    const now = new Date('2026-06-21T12:00:00Z');
    const rows = [
      row('2026-06-16 06:00', '2026/06/2026-06-16-0600-6h-btc', 2),
      row('2026-06-20 12:00', '2026/06/2026-06-20-1200-6h-btc', 4),
    ];
    let seenPrompt = '';
    const published: string[] = [];
    const res = await runWeekly(now, {
      rows,
      getArticle: () => `# t
**ナラティブ強度：3/10**

## 実データ計器盤（出典）

| 指標 | 実測値 | ソース |
|---|---|---|
| 価格 | $64,000 | CoinGecko |

※本記事は情報提供を目的としたものであり、投資助言ではありません。
`,
      generate: async (prompt: string) => { seenPrompt = prompt; return `# 週次タイトル
**ナラティブ強度：4/10**
本文。
※本記事は情報提供を目的としたものであり、投資助言ではありません。
`; },
      publish: (opts) => { published.push(opts.markdown); return { path: 'p', skipped: false }; },
    });
    expect(seenPrompt).toContain('合成強度は 4/10');
    // 公開された本文に週間計器盤が差し込まれている
    expect(published[0]).toContain('## 週間計器盤（W/W）');
    expect(res.skipped).toBe(false);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run pipeline/weekly/run-weekly.test.ts`
Expected: FAIL（run-weekly 未作成）

- [ ] **Step 3: run-weekly.ts を実装**

`pipeline/weekly/run-weekly.ts`:

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run pipeline/weekly/run-weekly.test.ts && npx tsc --noEmit`
Expected: PASS／型エラー無し

- [ ] **Step 5: ドライランのスモーク確認（任意・API鍵があれば）**

Run: `GEMINI_API_KEY=$GEMINI_API_KEY npx tsx pipeline/weekly/run-weekly.ts --no-publish`
Expected: `/tmp/weekly-dryrun.md` が生成され、横断記事＋`## 週間計器盤（W/W）`を含む。鍵が無ければこのステップはスキップしてよい。

- [ ] **Step 6: コミット**

```bash
git add pipeline/weekly/run-weekly.ts pipeline/weekly/run-weekly.test.ts
git commit -m "feat(weekly): 週次実行エントリ(run-weekly)を実装"
```

---

## Task 7: GitHub Actions ワークフロー

**Files:**
- Create: `.github/workflows/publish-weekly.yml`

**Interfaces:**
- Consumes: `pipeline/weekly/run-weekly.ts`（Task 6）。

- [ ] **Step 1: ワークフローを作成**

`.github/workflows/publish-weekly.yml`（既存 `publish-btc.yml` のコミット手順を踏襲。発火は外部cron＝cron-job.org からの workflow_dispatch）:

```yaml
name: publish-weekly
on:
  # 発火は外部cron(cron-job.org)からのworkflow_dispatch。日曜21:00 JSTにトリガーを設定する。
  workflow_dispatch:

permissions:
  contents: write

# 6h公開ジョブと同じ INDEX.md を触るため直列化して競合を避ける
concurrency:
  group: publish-btc
  cancel-in-progress: false

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
      - run: npm ci
      - name: Generate weekly article
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npx tsx pipeline/weekly/run-weekly.ts
      - name: Commit & push to main
        run: |
          git config user.name "KEISUKE-MYPC"
          git config user.email "keisukematsu0820@gmail.com"
          git add -A
          if git diff --cached --quiet; then echo "no changes"; exit 0; fi
          git commit -m "publish: 週次メタナラティブ統合 (auto)"
          git pull --rebase origin main
          git push origin HEAD:main
```

- [ ] **Step 2: YAML 妥当性を目視確認**

`.github/workflows/publish-btc.yml` と見比べ、`concurrency.group` が `publish-btc` で揃っていること、コミット作者が既存と同一（Vercel Hobby のデプロイ条件）であることを確認。

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/publish-weekly.yml
git commit -m "ci(weekly): 週次公開ワークフローを追加"
```

- [ ] **Step 4: 外部cron登録（手動・コード外）**

cron-job.org に「日曜21:00 JST」のジョブを追加し、`publish-weekly.yml` を `workflow_dispatch` で叩く（既存6hジョブと同じ叩き方）。GitHub の Personal Access Token / Authorization ヘッダは既存ジョブの設定を流用。**この手順はリポジトリ外なので、実装完了後にユーザーが実施する**。

---

## 全体の最終確認

- [ ] **Step 1: 全テスト・型・ビルドを通す**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: 全テストPASS／型エラー無し／ビルド成功

- [ ] **Step 2: 最終コミット（あれば）**

```bash
git add -A
git commit -m "chore(weekly): 週次メタナラティブ統合の実装を仕上げ" || echo "nothing to commit"
```

---

## Self-Review（計画作成者の確認メモ）

- **Spec coverage**: 入力/W/W導出=Task2、記事構成=Task4プロンプト、パイプライン4ファイル=Task2-6、サイト配置(weeklyカテゴリ/チャート除外)=Task1、スケジューリング=Task7、テスト/エッジ(欠落銘柄・初週・パース失敗)=Task2,3,5テストで網羅。
- **Placeholder scan**: 全ステップに実コードあり。TODO/TBD無し。
- **Type consistency**: `WeekData`/`AssetWeek`/`WeekArticle` はTask2で定義しTask3-6で同一フィールド名を使用。`publishWeekly` のシグネチャはTask5定義＝Task6 `RunWeeklyDeps.publish` と一致。`articleRelPath` の引数緩和は6h呼び出しと両立。
- **既存挙動の非破壊**: `articleRelPath` は構造型に緩めるのみ（AssetConfigは満たす）。`app/page.tsx` は metaCategory 除外フィルタを足すのみ＝既存4銘柄チャートは不変。
