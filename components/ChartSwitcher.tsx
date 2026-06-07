'use client';
import { useState } from 'react';
import { NarrativeChart, type ChartPoint } from './NarrativeChart';

export type ChartSeries = {
  slug: string;
  short: string;
  label: string;
  color: string;
  points: ChartPoint[];
};

// 分野ごとにチャートを切り替える。タブの選択状態で「いまどの分野か」を示す。
export function ChartSwitcher({ series }: { series: ChartSeries[] }) {
  const [active, setActive] = useState(series[0]?.slug ?? '');
  if (series.length === 0) return null;
  const current = series.find((s) => s.slug === active) ?? series[0];

  return (
    <div className="chart-switch">
      <div className="chart-tabs" role="tablist" aria-label="分野でチャートを切り替え">
        {series.map((s) => {
          const isActive = s.slug === current.slug;
          return (
            <button
              key={s.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? 'is-active' : undefined}
              style={isActive ? ({ '--tab-accent': s.color } as React.CSSProperties) : undefined}
              onClick={() => setActive(s.slug)}
            >
              {s.short}
            </button>
          );
        })}
      </div>
      <div className="chart-frame">
        <NarrativeChart data={current.points} color={current.color} />
      </div>
      <p className="chart-current">
        表示中：<strong>{current.label}</strong> — 強度の推移
      </p>
    </div>
  );
}
