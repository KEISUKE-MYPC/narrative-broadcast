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

const ACCENT = '#2f7e95'; // 落ち着いた青〜ティール（--accent 相当）
const TICK = 'rgba(60, 72, 84, 0.5)';

export function NarrativeChart({
  data,
  color = ACCENT,
}: {
  data: ChartPoint[];
  color?: string;
}) {
  // ResponsiveContainerはSSR時に寸法を測れないため、マウント後のみ描画する
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 古い順（左→右）に並べ替え
  const series = [...data].reverse();

  return (
    <div style={{ width: '100%', height: 240 }}>
      {mounted && (
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="datetime"
              tick={{ fontSize: 10, fill: TICK }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(60,72,84,0.18)' }}
              tickMargin={8}
              hide={series.length > 14}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 5, 10]}
              tick={{ fontSize: 10, fill: TICK }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(60,72,84,0.25)', strokeWidth: 1 }}
              contentStyle={{
                background: '#fff',
                border: '1px solid oklch(0.90 0.006 230)',
                borderRadius: 8,
                fontSize: 12,
                color: 'oklch(0.30 0.012 235)',
                boxShadow: '0 4px 16px rgba(40,55,70,0.10)',
              }}
              labelStyle={{ color: 'oklch(0.50 0.012 235)', marginBottom: 2 }}
              formatter={(v) => [`強度 ${v}/10`, '']}
              labelFormatter={(l) => String(l)}
            />
            <Line
              type="monotone"
              dataKey="strength"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
