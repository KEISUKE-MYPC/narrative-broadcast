import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseIndex } from '../lib/index-parser';

const sample = readFileSync(join(__dirname, 'fixtures/INDEX.sample.md'), 'utf8');

describe('parseIndex', () => {
  it('テーブル行を構造化し、ヘッダ/区切り行を除外する', () => {
    const rows = parseIndex(sample);
    expect(rows).toHaveLength(2);
  });
  it('強度を数値とデルタに分解する', () => {
    const [first] = parseIndex(sample);
    expect(first.strength).toBe(5);
    expect(first.strengthDelta).toBe('−1');
  });
  it('ファイルリンクからslugを抽出する（.md除去）', () => {
    const [first] = parseIndex(sample);
    expect(first.slug).toBe('2026/06/2026-06-06-1504-6h-btc');
    expect(first.datetime).toBe('2026-06-06 15:04');
    expect(first.narrative).toBe('言説の空洞化');
  });
});
