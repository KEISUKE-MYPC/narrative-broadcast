import { categoryFromSlug } from '@/lib/categories';
import type { CSSProperties } from 'react';

// 分野ブランドのアイキャッチ・バナー（CSS描画・1200:630比）。
// 長いナラティブ見出しは載せず、分野シンボル＋ラベル＋強度で“分野が一目で分かる”意匠にする。
type Props = {
  slug: string;
  strength?: number;
  datetime?: string;
  variant?: 'card' | 'hero';
};

export function Eyecatch({ slug, strength, datetime, variant = 'card' }: Props) {
  const cat = categoryFromSlug(slug);
  const style = { '--ec-accent': cat.accent } as CSSProperties;

  return (
    <div className={`eyecatch eyecatch-${variant}`} style={style} aria-hidden="true">
      <div className="ec-grid" />
      {/* コインの公式ロゴ（フルカラー）を焦点シンボルに（規約: /icons/<slug>.svg） */}
      <img className="ec-symbol-img" src={`/icons/${cat.slug}.svg`} alt="" />
      <span className="ec-chip">{cat.short}</span>
      <p className="ec-label">{cat.label}</p>
      <div className="ec-foot">
        <span className="ec-foot-left">
          {typeof strength === 'number' && (
            <span className="ec-strength">強度 {strength}/10</span>
          )}
          {datetime && <span className="ec-date">{datetime} JST</span>}
        </span>
        <span className="ec-brand">Narrative Broadcast</span>
      </div>
    </div>
  );
}
