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
