# 設計仕様

## 1. アーキテクチャ

```text
Google Meet DOM
      │
      ▼
content script ── CaptionObserver ── CaptionRepository (IndexedDB)
      │                                      │
      │                                      ▼
      │                              TranscriptFormatter
      │                                      │
      ├── FloatingPanel ── copy / txt download
      │
      └── runtime message ── service worker ── DriveSyncService
                                             │
                                             ▼
                                       Google Drive API
```

## 2. WXTエントリポイント

想定構成は次のとおりとする。

- `entrypoints/meet.content.ts`: Meetページへの注入、字幕自動ON、DOM監視、パネル描画。
- `entrypoints/background.ts`: service worker。認証、Drive API、終了時・定期同期メッセージを処理。
- `entrypoints/options/`: OAuth状態、保存状態、将来の設定画面。
- `src/domain/`: 字幕レコード、整形、重複排除、セッション状態などのブラウザ非依存ロジック。
- `src/storage/`: IndexedDBリポジトリと拡張機能storageのアダプタ。
- `src/drive/`: OAuthトークン取得、フォルダ確保、TXTアップロード。
- `src/ui/`: パネルのDOM／スタイル／操作ロジック。

WXTのcontent scriptとbackgroundのAPI利用は各エントリポイントの実行関数内に限定する。ビルド時のNode環境でブラウザAPIを評価しない。

## 3. データモデル

### MeetingSession

```ts
type MeetingSession = {
  id: string;
  meetingKey: string;
  startedAt: number;
  lastCapturedAt: number;
  status: 'active' | 'ending' | 'completed' | 'sync-failed';
  driveFileId?: string;
  driveFolderId?: string;
};
```

### SubtitleEntry

```ts
type SubtitleEntry = {
  id: string;
  sessionId: string;
  sequence: number;
  occurredAt: number;
  speaker: string;
  text: string;
  sourceKey: string;
  finalized: boolean;
};
```

`sourceKey` はMeet DOM上の同一発話を更新として扱うための内部キーであり、利用者向けTXTには出力しない。DOMから安定した識別子が取れない場合は、話者・近接時刻・テキスト差分を組み合わせたヒューリスティックを使う。

## 4. 字幕取得フロー

1. Meet URLに一致するcontent scriptをdocument startで起動する。
2. 会議画面の出現を待ち、字幕トグルを検出する。
3. OFFならクリックし、ON後に字幕領域を検出する。
4. `MutationObserver` と必要な再スキャンタイマーで字幕の追加・更新を監視する。
5. 候補発話を正規化し、同一 `sourceKey` の未確定レコードを更新する。
6. 安定した発話を `CaptionRepository` に保存する。
7. 保存結果をUIへ反映し、一定間隔でDrive同期キューへ通知する。

DOM検出は `MeetSelectors` に集約し、aria-label、role、表示テキストの候補を優先順位付きで定義する。検出結果がなくてもcontent script全体が停止しない。

## 5. IndexedDB設計

データベース名は `meet-subtitles`、バージョンは明示的なマイグレーション番号で管理する。

- `sessions`: `id`を主キー、`meetingKey`と`status`にインデックス。
- `entries`: `id`を主キー、`sessionId + sequence`に複合インデックス、`sessionId + sourceKey`に更新用インデックス。
- `syncQueue`: `sessionId`を主キー、`state`と`updatedAt`にインデックス。

字幕の追加とセッションの更新は同一トランザクションで行う。UIは常にIndexedDBから読み直せるようにし、メモリ配列だけを正としない。

## 6. パネルUI

初期位置はMeetの主要コントロールと競合しにくい右上とする。利用者が移動した座標は拡張機能storageへ保存し、次回も復元する。

```text
┌ Meet Subtitles                         ┐
│ ● 字幕取得中       12件       [−]     │
│                                        │
│ [コピー] [TXT保存] [Drive保存状態]     │
│ 最終取得: 00:12:34                     │
└────────────────────────────────────────┘
```

ドラッグはヘッダー部分に限定し、ボタン操作・テキスト選択・キーボード操作と競合させない。折りたたみ時も取得状態と展開操作を残す。

## 7. コピーとTXT保存

`TranscriptFormatter` は `SubtitleEntry[]` を受け取り、表示・コピー・ダウンロード・Driveアップロードで同一の文字列を利用する。

- 改行コードは `\n`。
- 発話は `[hh:mm:ss] 話者名` と本文の2行。
- 発話間に空行を1行入れる。
- 本文前後の空白を正規化するが、本文内部の改行は保持する。

## 8. Drive同期

1. ユーザー操作でOAuthトークンを取得する。
2. 保存済みのフォルダIDがあれば存在確認する。
3. なければ `Meet Subtitles` フォルダを作成し、IDを拡張機能storageへ保存する。
4. `text/plain` のTXTファイルを作成する。
5. セッションの `driveFileId` と同期時刻をIndexedDBへ保存する。
6. 再同期時は同じDriveファイルを更新し、終了時に最新内容へする。

`drive.file` の制約上、ユーザーが手動作成した同名フォルダを横断的に検索できない場合がある。その場合は拡張機能が作成した管理対象フォルダを利用する。全Drive権限での検索は採用しない。

## 9. 終了検知

- 退出操作: Meetの退出ボタンにイベント監視を設定し、検知後に最終同期する。
- 会議終了表示: DOM上の終了状態を検出し、最終同期する。
- ページ遷移・タブ終了: `pagehide`、`beforeunload`相当の通知で終了処理を開始する。
- タブ切り替え: visibility changeだけでは終了処理を実行しない。

終了処理は冪等にする。同一セッションに対する多重通知は1回の同期へまとめる。終了時の通信が中断された場合は、次回Meet起動時に未完了の `syncQueue` を再試行する。

## 10. 権限方針

想定する権限は次のとおり。

- `storage`: UI状態、OAuth関連の最小メタデータ、DriveフォルダID。
- `unlimitedStorage` は必要性を検証してから判断し、初期実装では要求しない。
- `identity`: Google OAuthトークン取得。
- Meetのhost permission: `https://meet.google.com/*`。

字幕本文はIndexedDB、OAuth状態やUI設定は拡張機能storageに分ける。不要な `tabs`、`history`、全サイト権限は要求しない。

## 11. テスト方針

- ドメイン: 時刻整形、重複排除、テキスト整形、ファイル名生成をユニットテスト。
- ストレージ: fake IndexedDBまたはテスト用アダプタでCRUDと再読込を検証。
- UI: パネルの折りたたみ、ドラッグ、コピー、通知をDOMテスト。
- 統合: content scriptの字幕DOM変化とrepositoryへの保存を検証。
- 手動: Chrome／EdgeでMeet入室、字幕自動ON、リロード、退出、タブ終了、OAuth、Drive保存を確認。

## 12. 参照資料と調査制約

Context7 MCPは現環境で利用できないため、設計時の技術確認は公式一次資料を参照した。

- [WXT Entrypoints](https://wxt.dev/guide/essentials/entrypoints)
- [WXT Extension APIs](https://wxt.dev/guide/essentials/extension-apis)
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Google Drive APIの認証スコープ](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Driveのフォルダ作成](https://developers.google.com/workspace/drive/api/guides/folder)
