'use client';
import { useState, useEffect, useRef } from 'react';
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
const TICK = 'rgba(176, 186, 199, 0.62)'; // ダーク背景で読める軸ラベル色
const AXIS_LINE = 'rgba(176, 186, 199, 0.16)';

const PX_PER_POINT = 80; // 1点あたりの横幅（これを超えると横スクロール）
const H = 240;
const X_H = 24; // X軸の高さ（固定Y軸と本体で揃える）
const MARGIN = { top: 12, right: 16, bottom: 0, left: 0 };

// "2026-06-07 21:05" → "6/7 21:05"（年を省き短縮）
function fmtTick(value: string): string {
  const [date, time] = value.split(' ');
  if (!date) return value;
  const [, mo, da] = date.split('-');
  return time ? `${Number(mo)}/${Number(da)} ${time}` : `${Number(mo)}/${Number(da)}`;
}

export function NarrativeChart({
  data,
  color = ACCENT,
}: {
  data: ChartPoint[];
  color?: string;
}) {
  // ResponsiveContainerはSSR時に寸法を測れないため、マウント後のみ描画する
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  // 古い順（左→右）に並べ替え
  const series = [...data].reverse();

  // データ数が変わったら右端（最新）までスクロール
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [mounted, series.length]);

  // 1点=PX_PER_POINTの一定間隔。点が多ければ横スクロール、少なければ左詰めで自然な間隔
  // （100%下限を置くと、ETHのような少数点が全幅に引き伸ばされて間隔が広くなるため置かない）
  const innerWidth = `${series.length * PX_PER_POINT}px`;

  // 固定Y軸ラベルの縦位置（本体のプロット領域と一致させる）
  const plotTop = MARGIN.top;
  const plotH = H - MARGIN.top - X_H - MARGIN.bottom;
  const yLabels = [10, 5, 0].map((v) => ({ v, y: plotTop + (1 - v / 10) * plotH }));

  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {/* 左に固定するY軸（スクロールしても見える・手動配置で確実に描画） */}
      <div style={{ position: 'relative', width: 28, height: H, flexShrink: 0 }}>
        {yLabels.map(({ v, y }) => (
          <span
            key={v}
            style={{
              position: 'absolute', right: 6, top: y, transform: 'translateY(-50%)',
              fontSize: 10, color: TICK, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {v}
          </span>
        ))}
      </div>

      {/* スクロールするチャート本体 */}
      <div
        ref={scrollRef}
        className="chart-scroll"
        style={{ overflowX: 'auto', overflowY: 'hidden', flex: 1 }}
      >
        <div style={{ width: innerWidth, height: H }}>
          {mounted && (
            <ResponsiveContainer>
              <LineChart data={series} margin={MARGIN}>
                <XAxis
                  dataKey="datetime"
                  height={X_H}
                  tick={{ fontSize: 10, fill: TICK }}
                  tickLine={false}
                  axisLine={{ stroke: AXIS_LINE }}
                  tickMargin={8}
                  tickFormatter={fmtTick}
                  interval="preserveStartEnd"
                  minTickGap={44}
                />
                <YAxis hide domain={[0, 10]} ticks={[0, 5, 10]} width={0} />
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
      </div>
    </div>
  );
}
