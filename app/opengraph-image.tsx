import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-font';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Narrative Broadcast';

const INK = '#1b2230';
const INK2 = '#12161d';
const ON_INK = '#f4f6f9';
const ON_INK_DIM = '#aeb7c4';
const ACCENT = '#5cc6da';

export default async function Image() {
  const tagline = '市場参加者の物語と認知を6時間ごとに構造分析するナラティブの観測メディア';
  const font = await loadGoogleFont('Zen Kaku Gothic New', `${tagline}NarrativeBroadcast`, 700);
  const fonts = font
    ? [{ name: 'Zen Kaku Gothic New', data: font, weight: 700 as const, style: 'normal' as const }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          padding: '80px',
          textAlign: 'center',
          color: ON_INK,
          background: `radial-gradient(120% 120% at 50% -20%, ${ACCENT}55, transparent 60%), linear-gradient(158deg, ${INK}, ${INK2})`,
          fontFamily: 'Zen Kaku Gothic New, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: ACCENT,
            opacity: 0.85,
          }}
        />
        <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, letterSpacing: 1 }}>
          Narrative Broadcast
        </div>
        {font && (
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              fontWeight: 700,
              color: ON_INK_DIM,
              maxWidth: 900,
              lineHeight: 1.5,
            }}
          >
            {tagline}
          </div>
        )}
      </div>
    ),
    { ...size, fonts },
  );
}
