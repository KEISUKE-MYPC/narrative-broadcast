import { describe, it, expect } from 'vitest';
import { extractDescription } from './excerpt';

const SAMPLE = [
  '> ⚠️ 自動生成｜6ソース',
  '',
  '# マスクの語彙がBTCを攫う',
  '',
  '## 現在の支配的ナラティブ',
  'トレンド語彙の上位を `spcx`・`musk` が占め、BTCは **-49.08%** に位置する。',
  '',
  '## 構造分析',
].join('\n');

describe('extractDescription', () => {
  it('引用・H1・H2をスキップし最初の実段落を採用する', () => {
    const d = extractDescription(SAMPLE, 200);
    expect(d.startsWith('トレンド語彙の上位を')).toBe(true);
  });
  it('Markdown記法(コード・太字)を除去する', () => {
    const d = extractDescription(SAMPLE, 200);
    expect(d).toContain('spcx');
    expect(d).not.toContain('`');
    expect(d).not.toContain('**');
    expect(d).toContain('-49.08%');
  });
  it('maxLenで切り詰め…を付ける', () => {
    const d = extractDescription(SAMPLE, 10);
    expect(d.endsWith('…')).toBe(true);
    expect(d.length).toBe(11);
  });
  it('実段落が無ければ空文字を返す', () => {
    expect(extractDescription('# 見出しだけ\n\n> 引用だけ', 100)).toBe('');
  });
  it('※始まりの注釈行はスキップしてリード段落を採用する', () => {
    const raw = [
      '## 現在の支配的ナラティブ',
      '※Glassnode公開枠は更新停止のため同一値です。',
      'BTC自前の物語が不在のまま価格は半値圏で推移している。',
    ].join('\n');
    expect(extractDescription(raw, 200).startsWith('BTC自前の物語が不在')).toBe(true);
  });
});
