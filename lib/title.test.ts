import { describe, it, expect } from 'vitest';
import { shortTitle } from './title';

describe('shortTitle', () => {
  it('max字以内はそのまま返す（…を付けない）', () => {
    const s = 'あ'.repeat(40);
    expect(shortTitle(s, 40)).toBe(s);
  });
  it('ちょうどmax字はそのまま', () => {
    const s = 'い'.repeat(40);
    expect(shortTitle(s, 40)).toBe(s);
    expect(shortTitle(s, 40).endsWith('…')).toBe(false);
  });
  it('max字以内に区切りがあればそこで切り…を付ける', () => {
    const s = 'あ'.repeat(30) + '、' + 'い'.repeat(20); // 区切りは index 30
    expect(shortTitle(s, 40)).toBe('あ'.repeat(30) + '…');
  });
  it('区切りが無い長文はmax字でハード切り＋…（長さ max+1）', () => {
    const s = 'あ'.repeat(50);
    const r = shortTitle(s, 40);
    expect(r).toBe('あ'.repeat(40) + '…');
    expect(r.length).toBe(41);
  });
  it('区切りが前すぎる場合はハード切り（極端に短いタイトルを避ける）', () => {
    const s = 'あ、' + 'い'.repeat(50); // 区切りは index 1（max*0.6=24未満）
    expect(shortTitle(s, 40)).toBe(('あ、' + 'い'.repeat(50)).slice(0, 40) + '…');
  });
});
