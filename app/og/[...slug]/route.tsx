import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { loadGoogleFont } from '@/lib/og-font';

// 分野の公式ロゴSVGを読み込み data URI 化する（satoriは<img>のdata URIを描画できる）。
// 未配置の分野は null を返し、呼び出し側で文字ウォーターマークにフォールバックする。
async function loadIconDataUri(slug: string): Promise<string | null> {
  try {
    const svg = await readFile(join(process.cwd(), 'public', 'icons', `${slug}.svg`), 'utf8');
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } catch {
    return null;
  }
}

// 分野ごとに1枚だけ生成し、その分野の全記事で使い回す（記事数に依存せずビルドが軽い）。
// URL は /og/<分野slug>（例: /og/btc）。slugは1セグメント想定。
export const dynamic = 'force-static';
export const dynamicParams = false;

const SIZE = { width: 1200, height: 630 };
const INK = '#1b2230';
const INK2 = '#12161d';
const ON_INK = '#f4f6f9';

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: [c.slug] }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const cat = getCategory(slug[0]);
  const accent = cat.ogAccent;
  const logo = await loadIconDataUri(cat.slug);

  const font = await loadGoogleFont(
    'Zen Kaku Gothic New',
    `${cat.label}NarrativeBroadcast`,
    700,
  );
  const fonts = font
    ? [{ name: 'Zen Kaku Gothic New', data: font, weight: 700 as const, style: 'normal' as const }]
    : [];
  const label = font ? cat.label : cat.short;
  // 「<英語名> ナラティブ」を最初の空白で2行に分割（コイン名の長さに依存せず綺麗に改行）。
  // 空白が無い（フォント未読込でshort表示など）場合は1行。
  const sp = label.indexOf(' ');
  const labelLines = sp >= 0 ? [label.slice(0, sp), label.slice(sp + 1)] : [label];

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
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: accent, opacity: 0.85 }} />
        {/* 分野の公式ロゴ（フルカラー焦点シンボル）。未配置なら文字ウォーターマークにフォールバック */}
        {logo ? (
          <img
            src={logo}
            width={340}
            height={340}
            style={{ position: 'absolute', right: 72, top: 145 }}
          />
        ) : (
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
        )}

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

        {/* 中段：分野ラベル（英語名／ナラティブ の2行） */}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 620 }}>
          {labelLines.map((ln, i) => (
            <div
              key={i}
              style={{ display: 'flex', fontSize: 92, fontWeight: 700, letterSpacing: 1, lineHeight: 1.12, color: ON_INK }}
            >
              {ln}
            </div>
          ))}
        </div>

        {/* 下段：ブランド */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 30 }}>
          <div style={{ display: 'flex', fontWeight: 700, letterSpacing: 2, color: ON_INK }}>
            Narrative Broadcast
          </div>
        </div>
      </div>
    ),
    { ...SIZE, fonts },
  );
}
