import { ImageResponse } from 'next/og';
import { getArticleSlugs } from '@/lib/articles';
import { categoryFromSlug } from '@/lib/categories';
import { getIndexRowBySlug } from '@/lib/index-parser';
import { loadGoogleFont } from '@/lib/og-font';

export const dynamic = 'force-static';

const SIZE = { width: 1200, height: 630 };
const INK = '#1b2230';
const INK2 = '#12161d';
const ON_INK = '#f4f6f9';
const ON_INK_DIM = '#aeb7c4';

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug: slug.split('/') }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const slugPath = slug.join('/');
  const cat = categoryFromSlug(slugPath);
  const row = getIndexRowBySlug(slugPath);
  const accent = cat.ogAccent;

  const strengthText = row ? `強度 ${row.strength}/10` : '';
  const dateText = row ? `${row.datetime} JST` : '';

  // この画像で使う文字をまとめてサブセット取得
  const glyphs = `${cat.label}${cat.short}${strengthText}${dateText}NarrativeBroadcast0123456789/年月日時分 -:`;
  const font = await loadGoogleFont('Zen Kaku Gothic New', glyphs, 700);
  const fonts = font
    ? [{ name: 'Zen Kaku Gothic New', data: font, weight: 700 as const, style: 'normal' as const }]
    : [];
  // フォント取得失敗時は日本語が描けないため英字主体にフォールバック
  const label = font ? cat.label : cat.short;
  const strength = font ? strengthText : row ? `Strength ${row.strength}/10` : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          color: ON_INK,
          background: `radial-gradient(120% 130% at 86% -10%, ${accent}66, transparent 60%), linear-gradient(158deg, ${INK}, ${INK2})`,
          fontFamily: 'Zen Kaku Gothic New, sans-serif',
          position: 'relative',
        }}
      >
        {/* 上端アクセントライン */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: accent,
            opacity: 0.85,
          }}
        />
        {/* 分野シンボル（ウォーターマーク） */}
        <div
          style={{
            position: 'absolute',
            right: 24,
            top: 90,
            fontSize: 460,
            fontWeight: 700,
            color: accent,
            opacity: 0.14,
            lineHeight: 1,
            display: 'flex',
          }}
        >
          {cat.short}
        </div>

        {/* 上段：分野チップ */}
        <div style={{ display: 'flex' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 4,
              color: ON_INK,
              background: `${accent}33`,
              border: `2px solid ${accent}99`,
              borderRadius: 999,
              padding: '10px 28px',
            }}
          >
            {cat.short}
          </div>
        </div>

        {/* 中段：分野ラベル */}
        <div
          style={{
            display: 'flex',
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: 1,
            color: ON_INK,
            maxWidth: 900,
          }}
        >
          {label}
        </div>

        {/* 下段：強度・日時／ブランド */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 30,
            color: ON_INK_DIM,
          }}
        >
          <div style={{ display: 'flex', gap: 28, alignItems: 'baseline' }}>
            {strength && <span style={{ color: accent, fontWeight: 700 }}>{strength}</span>}
            {dateText && <span>{dateText}</span>}
          </div>
          <div style={{ display: 'flex', fontWeight: 700, letterSpacing: 2, color: ON_INK }}>
            Narrative Broadcast
          </div>
        </div>
      </div>
    ),
    { ...SIZE, fonts },
  );
}
