import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSantiment } from './santiment';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/santiment.json'), 'utf8'),
);

describe('parseSantiment', () => {
  it('returns the latest datetime bucket words sorted by score desc', () => {
    const words = parseSantiment(raw);
    expect(words[0].word).toBe('spacex');
    expect(words[0].score).toBe(1004);
    expect(words).toHaveLength(2);
  });
  it('returns [] when getTrendingWords is missing', () => {
    expect(parseSantiment({})).toEqual([]);
  });
});
