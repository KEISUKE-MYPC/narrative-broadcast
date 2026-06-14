import { describe, it, expect } from 'vitest';
import { recomputeIndex, buildJudgePrompt } from './backfill-strength';

const HEADER = [
  '# 配信インデックス',
  '',
  '| 配信日時(JST) | サイクル | 支配的ナラティブ | 強度(前回比) | 主要データ | ファイル |',
  '|---|---|---|---|---|---|',
].join('\n');

// 新しい順（上が最新）。btcが3行、ethが1行。すべて現状1/10。
const ROWS = [
  '| 2026-06-14 12:00 | 6h | btc-c | 1/10 (±0) | k3 | [link](2026/06/c-btc.md) |',
  '| 2026-06-14 06:00 | 6h | eth-a | 1/10 (±0) | ke | [link](2026/06/a-eth.md) |',
  '| 2026-06-14 00:00 | 6h | btc-b | 1/10 (±0) | k2 | [link](2026/06/b-btc.md) |',
  '| 2026-06-13 18:00 | 6h | btc-a | 1/10 (±0) | k1 | [link](2026/06/a-btc.md) |',
];
const INDEX = HEADER + '\n' + ROWS.join('\n') + '\n';

describe('recomputeIndex', () => {
  it('強度を差し替え、銘柄ごとに時系列でdeltaを再計算する', () => {
    // btc: 時系列(古→新) a=4, b=7, c=5 / eth: a=8
    const map = new Map<string, number>([
      ['2026/06/a-btc', 4],
      ['2026/06/b-btc', 7],
      ['2026/06/c-btc', 5],
      ['2026/06/a-eth', 8],
    ]);
    const out = recomputeIndex(INDEX, map);
    // 最古btc(a)は±0、b=7(+3)、c=5(-2)。ethは1件なので±0。
    expect(out).toContain('| btc-a | 4/10 (±0) |');
    expect(out).toContain('| btc-b | 7/10 (+3) |');
    expect(out).toContain('| btc-c | 5/10 (-2) |');
    expect(out).toContain('| eth-a | 8/10 (±0) |');
  });

  it('mapに無いslugは現状の強度を保持する', () => {
    const out = recomputeIndex(INDEX, new Map([['2026/06/a-btc', 6]]));
    // a-btc=6に。b,cはmap無し→現状1のまま。btc時系列: a=6(±0), b=1(-5), c=1(±0)
    expect(out).toContain('| btc-a | 6/10 (±0) |');
    expect(out).toContain('| btc-b | 1/10 (-5) |');
    expect(out).toContain('| btc-c | 1/10 (±0) |');
  });

  it('ヘッダ・区切り・他カラム・リンクは保持する', () => {
    const out = recomputeIndex(INDEX, new Map([['2026/06/a-btc', 4]]));
    expect(out).toContain('# 配信インデックス');
    expect(out).toContain('|---|---|---|---|---|---|');
    expect(out).toContain('[link](2026/06/a-btc.md)');
    expect(out).toContain('| 2026-06-13 18:00 | 6h | btc-a |');
    expect(out).toContain('| k1 |');
  });
});

describe('buildJudgePrompt', () => {
  it('強度判定の指示と出力形式を含み、本文を埋め込む', () => {
    const p = buildJudgePrompt('# 記事タイトル\n本文ABC');
    expect(p).toContain('ナラティブ強度');
    expect(p).toContain('1〜10');
    expect(p).toContain('本文ABC');
  });
});
