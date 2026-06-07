// next/og(Satori)用に Google Fonts から TTF/OTF を取得する。
// &text= で「使う文字だけ」をサブセット取得し軽量化。
// サーバー側fetchのUAでは Google が truetype を返すため、その形式をそのまま使う
// （Satori は woff2 を読めないため truetype/opentype が必要）。
export async function loadGoogleFont(
  family: string,
  text: string,
  weight = 700,
): Promise<ArrayBuffer | null> {
  const fam = family.replace(/ /g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${fam}:wght@${weight}&text=${encodeURIComponent(
    text,
  )}`;
  try {
    const cssRes = await fetch(url);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const m = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/);
    if (!m) return null;
    const fontRes = await fetch(m[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}
