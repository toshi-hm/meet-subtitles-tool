# meet-subtitles-tool 開発ガイド

## プロダクト概要

Google Meetの字幕を取得し、会議中に確認・コピー・TXT保存できるChromium系ブラウザ拡張機能です。会議終了時にはGoogle Driveの `Meet Subtitles` フォルダへ字幕を保存します。

## 開発環境

- TypeScript
- Bun（`/home/maya/.bun/bin/bun`）
- WXT / Manifest V3
- oxlint / oxfmt / markdownlint
- CIではlint・format checkとtestを別workflowにする
- Codexの既定モデルは `.codex/config.toml` の指定に従う

## 探索とドキュメント

- リポジトリの構成や依存関係を調べるときは、まず `/home/maya/.local/bin/graphify` で索引を更新し、`graphify query`、`graphify explain`、`graphify affected` で必要なファイルを絞り込む。
- 単純な全文検索で設計上の関係を推測しない。Graphifyで関係を確認したうえで、必要なファイルを直接読む。
- 技術仕様を調べるときはContext7を優先する。Context7が利用できない環境では、公式一次資料（WXT、Chrome for Developers、Google for Developers、MDN）を使い、判断をdocs/に記録する。
- Graphifyの生成物、認証情報、ローカル環境固有のファイルはGitに追加しない。

## 実装ルール

- 字幕本文は第三者に送信しない。Google Drive保存以外の外部通信を追加しない。
- service workerのメモリを永続状態の情報源にしない。IndexedDBまたは拡張機能のstorageを正とする。
- Google Driveの権限は最小権限の `drive.file` を基本とし、全Driveアクセス権限を追加しない。
- OAuth同意は初回のDrive保存操作から開始し、拡張機能起動時に無断で表示しない。
- MeetのDOMは変更される前提で、セレクタを1箇所に集約し、未検出時はUIに状態を表示する。
- タブ終了時の非同期処理は完了保証がないため、保存処理はIndexedDBに先に確定し、Drive保存は会議中の定期同期と終了時の最終同期を組み合わせる。
- すべてのユーザー向け文言は日本語にする。
- 変更は作業単位ごとにIssue・ブランチ・PRを作成し、細かくコミットする。PR作成後はセルフレビューとCI確認を行い、問題がなければマージする。

## 完了条件

変更には、関連テスト、フォーマット、lint、必要なドキュメント更新を含める。Google DriveやMeetの実環境でしか確認できない項目は、手動検証手順と既知の制約を明記する。
