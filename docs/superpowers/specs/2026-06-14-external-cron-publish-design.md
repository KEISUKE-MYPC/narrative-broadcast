# 定時公開を外部cron起動に切り替え — 設計書

作成日: 2026-06-14

## 背景・課題

6時間ごとのBTC記事公開は GitHub Actions の `schedule:` cron で発火させていたが、
GitHub側のスケジューラ遅延・スキップにより定時性が担保できない。
2026-06-13 の 21:17 JST 枠は約2時間遅延し、23:29 JST に発火した（記事自体は正常生成・公開）。
`:00` を避けて `:17` にずらす対策を入れても遅延は解消しなかった。これはGitHub側の仕様であり、
ワークフロー側のコード・cron式では制御できない。

## ゴール

6時間ごとのBTC記事公開を、GitHub cronの遅延に左右されず
**JST 00:00 / 06:00 / 12:00 / 18:00 に分単位で正確に** 発火させる。

非ゴール:
- 記事生成パイプライン（`pipeline/run.ts`）の変更
- commit/push/Vercelデプロイの仕組みの変更

## アーキテクチャ

発火源を GitHub schedule から外部cron（cron-job.org）に一本化する。

```
cron-job.org（定時・分単位で正確 / timezone=Asia/Tokyo, hours 0,6,12,18, minute 0）
   │  POST /repos/KEISUKE-MYPC/narrative-broadcast/actions/workflows/publish-btc.yml/dispatches
   │  Authorization: Bearer <fine-grained PAT>
   ▼
GitHub Actions: publish-btc（workflow_dispatch トリガー）
   │  npx tsx pipeline/run.ts btc → 記事生成 → owner identity で commit/push
   ▼
main push → Vercel 自動デプロイ → サイト反映
```

ワークフロー中身（生成・commit・push・concurrency制御）は一切変更しない。
発火の責務だけを外部に移す。

## 変更点

### ① リポジトリ側（唯一のコード変更）

`.github/workflows/publish-btc.yml` から `schedule:` ブロック（とその説明コメント）を削除する。
`workflow_dispatch: {}` はそのまま残す。これにより外部からの dispatch のみが発火源になり、
GitHub schedule による遅延発火・二重生成が起きなくなる。

変更前:
```yaml
on:
  workflow_dispatch: {}
  schedule:
    # 毎時ちょうど(分0)はGitHub側が混雑して遅延・スキップしやすいので分をずらす
    # 00:17 / 06:17 / 12:17 / 18:17 UTC = 09:17 / 15:17 / 21:17 / 03:17 JST
    - cron: '17 */6 * * *'
```

変更後:
```yaml
on:
  workflow_dispatch: {}
```

### ② GitHub PAT 発行（ブラウザ作業・ユーザー）

- Settings → Developer settings → **Fine-grained personal access token**
- Repository access: **narrative-broadcast のみ**
- Repository permissions: **Actions = Read and write**（workflow_dispatch 起動に必須）
- Expiry: **1年**
- 発行したトークンは cron-job.org にのみ登録し、他には保存しない

### ③ cron-job.org 設定（ブラウザ作業・ユーザー）

- URL: `https://api.github.com/repos/KEISUKE-MYPC/narrative-broadcast/actions/workflows/publish-btc.yml/dispatches`
- Method: **POST**
- Request body: `{"ref":"main"}`
- Custom headers:
  - `Authorization: Bearer <PAT>`
  - `Accept: application/vnd.github+json`
  - `X-GitHub-Api-Version: 2022-11-28`
- Schedule: timezone **Asia/Tokyo** / hours **0,6,12,18** / minute **0**
  （日本はサマータイムなしのため時刻ズレは発生しない）
- 失敗時メール通知: **ON**

## エラー処理・可観測性

- cron-job.org に実行履歴が残り、非2xx応答（例: トークン期限切れ=401）でメール通知される。
- ワークフロー側は既存の「`git diff --cached --quiet` なら no changes で exit 0」と
  `concurrency: publish-btc` をそのまま活用する。
- PAT 期限切れの約1週間前に GitHub からメール通知が来る → 年1回再発行する。

## リスクと割り切り

- **単一障害点**: cron-job.org が停止するとその枠の記事が出ない。
  定時性の優先度が低いため許容。失敗時メール通知で検知可能。
- **第三者にトークンを預ける**: スコープを「Actions起動・narrative-broadcast 1リポジトリのみ」に
  絞ることで、万一漏洩しても被害を「記事生成の不正起動」程度に限定する。

## 検証方法

1. ワークフロー編集をコミット・push 後、`schedule` が消え `workflow_dispatch` が残っていることを確認。
2. cron-job.org の「Run now」を1回実行。
3. GitHub Actions に publish-btc の run が起動し success することを確認。
4. 新規記事がコミットされ、サイト（narrative-broadcast.vercel.app）で HTTP 200 になることを確認。
5. 次の定時枠（直近の 00/06/12/18 JST）で自動発火することを確認。
