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

const ACCENT = '#cf9a55'; // オークル（--accent 相当）
const TICK = 'rgba(232, 226, 214, 0.42)';

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
          <LineChart data={series} margin={{ top: 10, right: 16, bottom: 4, left: -18 }}>
            <XAxis
              dataKey="datetime"
              tick={{ fontSize: 10, fill: TICK }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(232,226,214,0.16)' }}
              hide={series.length > 14}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 5, 10]}
              tick={{ fontSize: 10, fill: TICK }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(232,226,214,0.2)', strokeWidth: 1 }}
              contentStyle={{
                background: 'oklch(0.225 0.012 70)',
                border: '1px solid oklch(0.33 0.012 70)',
                borderRadius: 4,
                fontSize: 12,
                color: 'oklch(0.925 0.012 85)',
              }}
              labelStyle={{ color: 'rgba(232,226,214,0.6)', marginBottom: 2 }}
              formatter={(v) => [`強度 ${v}/10`, '']}
              labelFormatter={(l) => String(l)}
            />
            <Line
              type="monotone"
              dataKey="strength"
              stroke={ACCENT}
              strokeWidth={2}
              dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: ACCENT, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
