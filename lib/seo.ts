export const SITE_URL = 'https://narrative-broadcast.com';
export const SITE_NAME = 'Narrative Broadcast';
export const SITE_DESCRIPTION = '市場参加者の物語と認知を構造分析するナラティブ観測メディア';

export function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path}`;
}

// スラッグ末尾の日時から JST(+09:00) の ISO8601 を生成する
export function publishedISO(slug: string): string {
  const last = slug.split('/').pop() ?? slug;
  const dt = last.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/);
  if (dt) {
    const [, y, mo, d, h, mi] = dt;
    return `${y}-${mo}-${d}T${h}:${mi}:00+09:00`;
  }
  const dOnly = last.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dOnly) {
    const [, y, mo, d] = dOnly;
    return `${y}-${mo}-${d}T00:00:00+09:00`;
  }
  return '';
}
