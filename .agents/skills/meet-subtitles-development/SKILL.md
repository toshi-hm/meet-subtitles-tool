---
name: meet-subtitles-development
description: Google Meet字幕拡張機能の設計・実装・検証を行うためのリポジトリ固有ルール
---

# Meet Subtitles 開発スキル

## 作業開始時

1. `git status --short --branch` で作業ツリーを確認する。
2. `/home/maya/.local/bin/graphify update <repo>` を実行し、`graphify query` で対象領域の関係を確認する。
3. 要件・設計・UI/UXの文書を読み、既存決定と矛盾しないか確認する。
4. 変更単位にGitHub Issueを紐付け、`codex/` ブランチで作業する。

## 字幕機能

- DOM上の字幕要素の変化を監視し、更新途中の同一発話を重複保存しない。
- 保存レコードは話者、本文、会議セッション内の時刻、取得順を持つ。
- IndexedDBへの保存を先に完了させてから表示や外部同期を行う。
- フォーマットは次の2行構成を維持する。

  ```text
  [hh:mm:ss] 話者名
  発話内容
  ```

## Drive機能

- `drive.file` を利用し、`Meet Subtitles`フォルダとその配下に作成したTXTだけを扱う。
- OAuthはユーザー操作に起因するタイミングで開始する。
- トークンや字幕本文をログに出力しない。
- タブ終了時の保存を過信せず、会議中の定期同期と未同期キューを設計する。

## 検証

- 純粋なドメインロジックはブラウザAPIから分離してユニットテストする。
- `bun run check` を最終ゲートにする。
- lint/format check workflowとtest workflowは分離する。
- ChromeとEdgeの手動検証項目を分けて記録する。
