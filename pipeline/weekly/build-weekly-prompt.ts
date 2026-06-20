import type { WeekData } from './collect-week';

const LABEL: Record<string, string> = { btc: 'BTC', eth: 'ETH', xrp: 'XRP', sol: 'SOL' };

// 各銘柄の今週の語りの推移を素材としてダイジェスト化
function assetDigest(week: WeekData): string {
  const lines: string[] = [];
  for (const a of week.assets) {
    lines.push(
      `- ${LABEL[a.asset]}（${a.count}本）: ` +
      `週初「${a.first.title}」(強度${a.first.strength}) → ` +
      `週末「${a.last.title}」(強度${a.last.strength})`,
    );
  }
  if (week.missing.length) {
    lines.push(`- 記事なし: ${week.missing.map((m) => LABEL[m]).join('、')}`);
  }
  return lines.join('\n');
}

/** 週次メタナラティブ統合記事の生成プロンプト。 */
export function buildWeeklyPrompt(week: WeekData, datetimeJst: string): string {
  return `あなたはクリプト市場のナラティブ（言説）を構造分析するアナリストである。
以下は今週（${week.weekStart}〜${week.weekEnd} JST）に配信した、BTC/ETH/XRP/SOL の6h分析記事の要約である。
これらを横断し、「今週、市場全体の語りがどう動いたか」を1本のメタナラティブ統合記事にまとめよ。

## 今週の各銘柄の推移（素材）
${assetDigest(week)}

## 合成強度
今週末時点の市場全体の合成強度は ${week.compositeStrength}/10（4銘柄の週末強度の平均）。

## 出力要件（Markdown・日本語）
以下の構成・見出しで書くこと:
1. 「# 」見出しで、今週を貫いた統合メタナラティブを1行のタイトルに
2. 「**ナラティブ強度：${week.compositeStrength}/10**」の行（合成強度。前週比はサイトが付与するため数値のみ）
3. リード（2-3文）: 今週、市場の語りに何が起きたか
4. 「## 今週の支配的メタナラティブ」: 全銘柄を貫いた力学
5. 「## 銘柄別・週間スナップ」: BTC/ETH/XRP/SOL それぞれの週初→週末の語りの変化を簡潔に
6. 「## ナラティブの伝染・ローテーション」: 銘柄間で物語がどう移った/収斂したか
7. 「## 構造分析（週次）」: 表層/中層/深層 ＋ reflexivity を、今週の"変化"の観点で
8. 「## 今週の決定的変化点」: 3点
9. 「## 来週の観測ポイント」: 語りの分岐点
10. 末尾に「※本記事は情報提供を目的としたものであり、投資助言ではありません。」

## 厳守事項
- 価格予想・売買助言は禁止。認知の歪みや語りの構造を論じること。
- 数値は素材の範囲に忠実に。誇張しない。
- 配信日時: ${datetimeJst} JST。`;
}
