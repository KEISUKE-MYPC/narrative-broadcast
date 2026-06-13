import type { IndexRow } from '../../lib/index-parser';
import { getIndexRows } from '../../lib/index-parser';

export function recentNarratives(rows: IndexRow[], n: number): string[] {
  return rows.slice(0, n).map((r) => r.narrative);
}

export function loadRecentNarratives(n: number): string[] {
  return recentNarratives(getIndexRows(), n);
}
