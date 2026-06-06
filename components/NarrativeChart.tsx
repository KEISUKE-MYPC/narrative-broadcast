'use client';
import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export type ChartPoint = { datetime: string; strength: number; narrative: string };

export function NarrativeChart({ data }: { data: ChartPoint[] }) {
  // ResponsiveContainerはSSR時に寸法を測れないため、マウント後のみ描画する
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 古い順（左→右）に並べ替え
  const series = [...data].reverse();

  return (
    <div style={{ width: '100%', height: 240 }}>
      {mounted && (
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
            <XAxis dataKey="datetime" tick={{ fontSize: 10 }} hide={series.length > 12} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v) => [`強度 ${v}/10`, '']}
              labelFormatter={(l) => String(l)}
            />
            <Line type="monotone" dataKey="strength" stroke="#e0803a" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
