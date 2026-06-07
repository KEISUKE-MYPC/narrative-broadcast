import type { CSSProperties } from 'react';

// ワードマーク：文字ごとに白→ティールへ段階配色（各文字はsolid＝グラデ風）。
// 各文字に flow アニメ用の位相ディレイを与え、配色がゆっくり流れるようにする。
const TEXT = 'Narrative Broadcast';

// 白→ティールの端点（OKLCH）
const C1 = { l: 0.965, c: 0.006, h: 230 }; // 白
const C2 = { l: 0.78, c: 0.1, h: 205 }; // ティール

export function Wordmark() {
  const chars = TEXT.split('');
  const letterCount = chars.filter((ch) => ch !== ' ').length;
  let li = -1;

  return (
    <h1 className="hero-brand" aria-label={TEXT}>
      {chars.map((ch, i) => {
        if (ch === ' ') {
          return (
            <span key={i} className="hero-brand-space" aria-hidden="true">
              {' '}
            </span>
          );
        }
        li += 1;
        const t = letterCount > 1 ? li / (letterCount - 1) : 0;
        const l = (C1.l + (C2.l - C1.l) * t).toFixed(3);
        const c = (C1.c + (C2.c - C1.c) * t).toFixed(3);
        const h = (C1.h + (C2.h - C1.h) * t).toFixed(1);
        const style: CSSProperties = {
          // 静的配色（prefers-reduced-motion時のフォールバック）
          color: `oklch(${l} ${c} ${h})`,
          // reveal用ディレイ, flow用位相ディレイ
          animationDelay: `${(0.1 + li * 0.035).toFixed(3)}s, ${(-li * 0.15).toFixed(3)}s`,
        };
        return (
          <span key={i} className="hero-brand-letter" style={style} aria-hidden="true">
            {ch}
          </span>
        );
      })}
    </h1>
  );
}
