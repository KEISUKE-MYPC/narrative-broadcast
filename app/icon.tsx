import { ImageResponse } from 'next/og';

// ブランドのファビコン（ティール地＋ダークの "N"）。
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

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
          background: '#5cc6da',
          borderRadius: 14,
          color: '#12161d',
          fontSize: 44,
          fontWeight: 800,
        }}
      >
        N
      </div>
    ),
    { ...size },
  );
}
