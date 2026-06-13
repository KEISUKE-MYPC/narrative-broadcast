import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDefiLlama } from './defillama';

const raw = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/defillama.json'), 'utf8'),
);

describe('parseDefiLlama', () => {
  it('takes latest total and computes W/W vs ~7 points earlier', () => {
    const s = parseDefiLlama(raw);
    expect(s.total_usd).toBe(313340000000);
    expect(s.wow_change_pct).toBeCloseTo(-0.527, 1);
  });
});
