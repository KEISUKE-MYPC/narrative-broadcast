import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlassnodeMetric } from './glassnode';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/glassnode_mvrv.json'), 'utf8'),
);

describe('parseGlassnodeMetric', () => {
  it('returns the latest value and its UTC date', () => {
    const p = parseGlassnodeMetric(raw);
    expect(p.value).toBe(0.344);
    expect(p.asof).toMatch(/^2025-06-11|^\d{4}-\d{2}-\d{2}$/);
  });
  it('returns null for empty array', () => {
    expect(parseGlassnodeMetric([]).value).toBeNull();
  });
});
