import type { FetchBundle, AssetConfig } from './types';
import { GOLD_SAMPLE } from './gold-sample';

const GUARDRAILS = `# 厳守ルール（runbook §1/§4）
1. スコア系（Fear&Greed, sentiment_balance等）を結論にしない。「どう語られているか」の構造で論じる。
2. ベースライン必須：基準ATH（下記）から見て今どこかを述べる。
3. 断定・価格予想・売買助言をしない。認知の歪みの指摘に留める。
4. 読者は暗号資産の中〜上級者。分析語彙（MVRV-Z, SOPR, 資金調達率, 建玉, ドミナンス等）はそのまま使ってよく、毎回の括弧補足は不要（馴染みの薄い語だけ任意で一言補足）。
5. reflexivity（価格↔ナラティブの共変・リード/ラグ）を判定する。層（言説/ポジション/オンチェーン）の食い違いに注目。
6. タイトルは支配ナラティブを全角40字以内で（詳細な論証は本文に書く）。造語・比喩を避け「何が起きているか」を直接書く。「〜号」「今号」「速報」等の自己言及・体裁語で締めない。
7. 末尾に免責文。
8. 文体：一文一義で修飾を重ねない。独自の造語・多層的な比喩・カタカナ英語の直訳は禁止。
   - NG例：「物語の空洞化」「非共振」「逆駆動」「射幸レジスタ」「アンカリング・トゥ・ATH」
   - OK例：「内生的な物語が不在」「価格と言説が連動していない」
   比喩を使うなら1記事に1つまで、必ず説明を添える。`;

function fmtData(b: FetchBundle): string {
  const m = b.market, o = b.onchain, p = b.positions, s = b.stables;
  const lines: string[] = [];
  if (m) lines.push(`- 価格 $${m.price_usd}（24h ${m.chg_24h}% / 7d ${m.chg_7d}% / 30d ${m.chg_30d}%）ATH比 ${m.ath_change_pct}%（ATH $${m.ath} ${m.ath_date}）ドミナンス ${m.btc_dominance}%`);
  if (m) lines.push(`- 上昇セクター: ${m.sectors_top.map((x) => `${x.name}(${x.chg24h}%)`).join(', ')}`);
  if (o && o.metrics.length) lines.push(`- オンチェーン: ${o.metrics.map((x) => `${x.label} ${x.value ?? 'N/A'}`).join(' / ')}（asof ${o.asof ?? 'N/A'}）`);
  if (b.trends) lines.push(`- トレンド語: ${b.trends.map((w) => `${w.word}(${w.score})`).join(', ')}`);
  if (p) lines.push(`- ポジション: funding ${p.funding.map((f) => `${f.symbol}:${f.pct.toFixed(4)}%`).join(' / ')} / OI ${p.oi_usd != null ? '$' + (p.oi_usd / 1e9).toFixed(2) + 'B' : 'N/A'} / L/S long ${p.ls_long_pct ?? 'N/A'}%`);
  if (b.odds) lines.push(`- 年末オッズ: ${Object.entries(b.odds.targets).map(([k, v]) => `$${k}:${v}%`).join(' / ')}`);
  if (s) lines.push(`- ステーブル総供給 $${(s.total_usd / 1e9).toFixed(2)}B（W/W ${s.wow_change_pct?.toFixed(2) ?? 'N/A'}%）`);
  return lines.join('\n');
}

export function buildPrompt(
  bundle: FetchBundle, recentAngles: string[], cfg: AssetConfig, asofJST: string,
): string {
  const baseline = cfg.baselineAth
    ? `\n# ベースライン\n基準ATH $${cfg.baselineAth}（${cfg.baselineAthDate}）から見て今どこかを必ず述べる。\n`
    : '';
  const notesBlock = bundle.notes.length
    ? `\n# 取得失敗ソース（記事冒頭の注記に明記して続行）\n${bundle.notes.map((n) => `- ${n.source}: ${n.message}`).join('\n')}\n`
    : '';
  const recentBlock = recentAngles.length
    ? `\n# 直近の支配ナラティブ（これらと書き出し・比喩・切り口を被らせない）\n${recentAngles.map((a, i) => `${i + 1}. ${a.slice(0, 400)}`).join('\n')}\n`
    : '';
  const goldBlock = `\n# 文体の手本（書き方だけ真似る・内容は流用禁止）
下記はBTCの過去記事のプロ品質サンプル。真似るのは「リードで主張を1行で言い切る／全段落が1本のテーゼを証明する／短文と長文で緩急をつける／専門用語は残し造語・多層比喩は使わない／見出しの副題で中身を直接書く」という構成・文体・リズムだけ。書き出しの文・比喩・結論・「自分の言葉を失った」という切り口・このサンプルの数値や固有名詞は一切流用しない。今サイクルの実データから新しい切り口で書く。
--- 手本ここから ---
${GOLD_SAMPLE}
--- 手本ここまで ---\n`;
  return `あなたは「Narrative Broadcast」の書き手。${cfg.promptIntro}

${GUARDRAILS}
${baseline}
# 今サイクルの実データ（${asofJST} JST 取得）
${fmtData(bundle)}
${notesBlock}${recentBlock}${goldBlock}
# 出力形式
- 冒頭に「> ⚠️ 自動生成｜6ソース」を置く。
- \`# タイトル\`（支配ナラティブを全角40字以内・煽らない）
- タイトル直後の行に「**ナラティブ強度：N/10**」を必ず置く（Nは1〜10の整数）。強度＝支配的ナラティブが言説・ポジション・オンチェーンの各層をどれだけ束ね共振させているか。10=全層が単一の物語に強く共振、5=部分的に共振、1=物語が不在で各層がバラバラ。今サイクルの実データに基づき判定する。
- articles/_template.md の6h構成（現在の支配的ナラティブ / 構造分析[表層・中層・深層＋reflexivity] / 競合ナラティブ / 注目すべき変化点 / トレーダー視点の示唆[価格予想・売買助言禁止]）
- 末尾に免責文「※本記事は情報提供を目的としたものであり、投資助言ではありません。」

Markdownで記事本文のみを出力（説明文や前置きは不要）。`;
}
