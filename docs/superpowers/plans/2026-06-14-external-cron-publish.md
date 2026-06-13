# 定時公開を外部cron起動に切り替え 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6時間ごとのBTC記事公開を、GitHub cronの遅延に左右されず JST 00:00/06:00/12:00/18:00 に正確に発火させる。

**Architecture:** 発火源を GitHub Actions の `schedule:` cron から外部cron（cron-job.org）に一本化する。cron-job.org が定時に GitHub REST API の workflow_dispatch を叩き、既存の publish-btc ワークフロー（生成・commit・push）をそのまま起動する。リポジトリ側のコード変更は `schedule:` ブロックの削除のみ。

**Tech Stack:** GitHub Actions (workflow_dispatch), GitHub REST API (`/actions/workflows/.../dispatches`), Fine-grained PAT, cron-job.org

---

## ファイル構成

- Modify: `.github/workflows/publish-btc.yml` — `schedule:` ブロックを削除し、`workflow_dispatch: {}` のみを発火源にする
- （リポジトリ外）GitHub Fine-grained PAT — cron-job.org がdispatchするための認証
- （リポジトリ外）cron-job.org のジョブ — 定時にdispatchを叩く発火源

リポジトリ内のコード変更は `publish-btc.yml` の1ファイルのみ。Task 2〜3はブラウザでの外部設定（ユーザー作業）。

---

### Task 1: ワークフローから schedule を削除する

**Files:**
- Modify: `.github/workflows/publish-btc.yml`

- [ ] **Step 1: 現状の `on:` ブロックを確認する**

Run: `sed -n '1,8p' .github/workflows/publish-btc.yml`
Expected: 以下が表示される
```yaml
name: publish-btc
on:
  workflow_dispatch: {}
  schedule:
    # 毎時ちょうど(分0)はGitHub側が混雑して遅延・スキップしやすいので分をずらす
    # 00:17 / 06:17 / 12:17 / 18:17 UTC = 09:17 / 15:17 / 21:17 / 03:17 JST
    - cron: '17 */6 * * *'
```

- [ ] **Step 2: `schedule:` ブロックを削除する**

`.github/workflows/publish-btc.yml` の冒頭を以下に変更する（`schedule:` とコメント・cron行を削除し、`workflow_dispatch: {}` のみ残す）。

変更後の `on:` ブロック:
```yaml
name: publish-btc
on:
  # 発火は外部cron(cron-job.org)からのworkflow_dispatchに一本化。
  # GitHub schedule cronは遅延・スキップが直せないため廃止した（2026-06-14）。
  workflow_dispatch: {}
```

`permissions:` 以降（contents: write, concurrency, jobs）は一切変更しない。

- [ ] **Step 3: schedule が消え workflow_dispatch が残ったことを確認する**

Run: `grep -nE 'schedule|cron|workflow_dispatch' .github/workflows/publish-btc.yml`
Expected: `workflow_dispatch: {}` の行のみがヒットし、`schedule` と `cron` は1件もヒットしない。

- [ ] **Step 4: YAMLが壊れていないことを確認する**

Run: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/publish-btc.yml')); assert 'workflow_dispatch' in d['on']; assert 'schedule' not in d['on']; print('OK: on =', list(d['on'].keys()))"`
Expected: `OK: on = ['workflow_dispatch']`

- [ ] **Step 5: コミットする**

```bash
git add .github/workflows/publish-btc.yml
git commit -m "ci(pipeline): GitHub schedule cronを廃止し外部cron(workflow_dispatch)に一本化"
```

- [ ] **Step 6: push する**

```bash
git push origin main
```

Run後: `git log --oneline -1`
Expected: 直前のコミットがpush済み（`origin/main` と一致）。

---

### Task 2: GitHub Fine-grained PAT を発行する（ブラウザ作業）

**Files:** なし（GitHub Web UI 上の操作）

> このタスクはユーザーがブラウザで実施する。エージェントは手順を提示し、完了確認する。

- [ ] **Step 1: Fine-grained token 作成画面を開く**

URL: https://github.com/settings/personal-access-tokens/new

- [ ] **Step 2: 基本設定を入力する**

- Token name: `narrative-broadcast cron dispatch`
- Expiration: **Custom → 1年後の日付**（2027-06-14 目安）
- Repository access: **Only select repositories → narrative-broadcast** を選択

- [ ] **Step 3: 権限を絞る**

- Repository permissions → **Actions** を **Read and write** に設定
- それ以外の権限はすべて **No access** のまま（Metadata は自動でRead-onlyになる。それでよい）

- [ ] **Step 4: トークンを生成して控える**

- 「Generate token」をクリック
- 表示された `github_pat_...` をコピーして安全な場所に一時保管（この画面を離れると二度と表示されない）

- [ ] **Step 5: 完了確認**

トークン文字列（`github_pat_` で始まる）が手元にあること。次のTaskで cron-job.org に登録する。

---

### Task 3: cron-job.org にジョブを登録する（ブラウザ作業）

**Files:** なし（cron-job.org Web UI 上の操作）

> このタスクはユーザーがブラウザで実施する。エージェントは手順を提示し、完了確認する。

- [ ] **Step 1: cron-job.org にログイン/登録する**

URL: https://console.cron-job.org/ （無料アカウント。未登録ならサインアップ）

- [ ] **Step 2: 新規ジョブの URL とメソッドを設定する**

- Create cronjob をクリック
- Title: `narrative-broadcast publish-btc`
- URL: `https://api.github.com/repos/KEISUKE-MYPC/narrative-broadcast/actions/workflows/publish-btc.yml/dispatches`
- （Advanced settings で）Request method: **POST**

- [ ] **Step 3: スケジュールを設定する**

- Schedule タブで timezone を **Asia/Tokyo** に設定
- Hours: **0, 6, 12, 18** を選択
- Minutes: **0** のみ
- Days / Months / Weekdays: every（すべて）

- [ ] **Step 4: ヘッダーとボディを設定する**

Advanced settings の Headers に以下3つを追加:
- `Authorization` : `Bearer <Task2で控えたPAT>`
- `Accept` : `application/vnd.github+json`
- `X-GitHub-Api-Version` : `2022-11-28`

Request body に以下を設定:
```json
{"ref":"main"}
```

- [ ] **Step 5: 失敗通知を有効化して保存する**

- Notifications で「on failure（失敗時）」のメール通知を ON
- Save でジョブを保存

---

### Task 4: 動作検証

**Files:** なし（実行確認）

- [ ] **Step 1: cron-job.org から手動実行する**

cron-job.org のジョブ詳細画面で **「Run now」** を1回クリックする。

- [ ] **Step 2: dispatch が 204 で受理されたことを確認する**

cron-job.org の実行履歴（History）で、直近の実行が **HTTP 204 No Content** であることを確認する。
（204 = workflow_dispatch 受理成功。401/403ならPATの権限・期限を見直す。404ならURL/リポジトリ名を見直す。）

- [ ] **Step 3: GitHub Actions が起動したことを確認する**

Run: `gh run list --workflow=publish-btc.yml --limit 3`
Expected: 最上段に `workflow_dispatch` トリガーの run が新しく出現し、`in_progress` または `completed success` になっている。

- [ ] **Step 4: 記事が公開されたことを確認する**

Run（run完了後）: `gh run list --workflow=publish-btc.yml --limit 1` で success を確認後、
```bash
git pull --rebase origin main
ls -t articles/2026/06/ | head -3
```
Expected: 直近の時刻の新規記事 `.md` が追加されている（no changesでスキップされた場合は記事追加なし=正常動作の範囲）。

- [ ] **Step 5: サイト反映を確認する**

Run: 公開された記事スラッグを使い
```bash
curl -sL -o /dev/null -w "HTTP %{http_code}\n" "https://narrative-broadcast.vercel.app/articles/2026/06/<新記事スラッグ>"
```
Expected: 数分のVercelデプロイ後に `HTTP 200`。

- [ ] **Step 6: 次の定時枠で自動発火を確認する**

直近の JST 00:00 / 06:00 / 12:00 / 18:00 の枠を過ぎたあと、`gh run list --workflow=publish-btc.yml --limit 3` で
その時刻付近に `workflow_dispatch` run が自動で出現していることを確認する。

---

## Self-Review メモ

- **Spec coverage:** 設計書の変更点①（schedule削除）=Task1、②（PAT発行）=Task2、③（cron-job.org設定）=Task3、検証方法=Task4。全項目に対応タスクあり。
- **Placeholder:** `<Task2で控えたPAT>` / `<新記事スラッグ>` は実行時に確定する実値プレースホルダであり、手順上必須の可変項目。曖昧な「TBD」ではない。
- **整合性:** URL・ヘッダー・ボディ・スケジュール値は設計書と一致。HTTP 204=dispatch成功の前提も整合。
