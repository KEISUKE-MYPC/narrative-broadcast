import { ImageResponse } from 'next/og';

// ブランドファビコン：ブロードキャストの“パルス”マーク
// （ダークなアプリアイコン地＋ティールの同心円リング＋中央ノード）。
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

const ACCENT = '#5cc6da';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderRadius: 16,
          background: 'linear-gradient(145deg, #1f2937, #0e1218)',
        }}
      >
        {/* 外リング（淡） */}
        <div
          style={{
            position: 'absolute',
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: `3px solid ${ACCENT}`,
            opacity: 0.22,
            display: 'flex',
          }}
        />
        {/* 中リング */}
        <div
          style={{
            position: 'absolute',
            width: 29,
            height: 29,
            borderRadius: '50%',
            border: `3px solid ${ACCENT}`,
            opacity: 0.6,
            display: 'flex',
          }}
        />
        {/* 中央ノード */}
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: ACCENT,
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
