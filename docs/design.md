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
      │
      ├── FloatingPanel ── copy / txt download
      │
      └── runtime message ── service worker ── Chrome Identity API ── Google Drive API
```

## 2. WXTエントリポイント

想定構成は次のとおりとする。

- `entrypoints/meet.content.ts`: Meetページへの注入、字幕自動ON、DOM監視、パネル描画。
- `entrypoints/background.ts`: service worker。Chrome Identity APIによる認証、Drive API、終了時・定期同期メッセージを処理。
- `entrypoints/popup.html`: 拡張機能アイコンから、Google Drive接続の説明を表示する。
- `src/domain/`: 字幕レコード、整形、重複排除、セッション状態などのブラウザ非依存ロジック。
- `src/storage/`: IndexedDBリポジトリと拡張機能storageのアダプタ。
- `src/drive/`: Chrome管理のアクセストークン取得、フォルダ確保、TXTアップロード。
- `src/ui/`: パネルのDOM／スタイル／操作ロジック。

WXTのcontent scriptとbackgroundのAPI利用は各エントリポイントの実行関数内に限定する。ビルド時のNode環境でブラウザAPIを評価しない。

## 3. データモデル

### MeetingSession

```ts
type MeetingSession = {
  id: string;
  meetingKey: string;
  startedAt: number;
  retentionExpiresAt: number;
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

セッション作成時に `retentionExpiresAt = startedAt + 24時間` を設定する。Meetページ起動時とページ表示中の定期処理で期限を確認し、期限切れのセッション、関連する `entries`、`syncQueue` を同一readwriteトランザクションで削除する。旧形式で期限がないセッションは `startedAt + 24時間` を期限として扱う。

## 6. パネルUI

入室後の初期位置はMeetの主要コントロールと競合しにくい右上とする。利用者が移動した座標は拡張機能storageへ保存し、次回も復元する。パネルはCSSのresize機能で幅・高さを変更できる。

```text
┌ Meet Subtitles                         ┐
│ ● 字幕取得中       12件       [−]     │
│ ┌────────────────────────────────────┐ │
│ │[00:00:12] 話者名                   │ │
│ │発話内容                            │ │
│ │              ↕ スクロール          │ │
│ └────────────────────────────────────┘ │
│ [コピー] [TXT保存] [Drive保存状態]     │
│ 最終取得: 00:12:34                     │
└────────────────────────────────────────┘
```

字幕履歴はIndexedDBから読み出した全件をパネル内のスクロール領域へ表示する。新しい字幕を追加・更新したとき、利用者が末尾を見ている場合だけ末尾へ追従し、上へさかのぼっている場合は現在位置を維持する。各発話は時刻・話者・本文を個別のDOM要素へ設定し、字幕本文をHTMLとして解釈しない。

ドラッグはヘッダー部分に限定し、ボタン操作・テキスト選択・キーボード操作と競合させない。折りたたみ時も取得状態と件数、展開ボタンを残す。

## 7. コピーとTXT保存

`TranscriptFormatter` は `SubtitleEntry[]` を受け取り、表示・コピー・ダウンロード・Driveアップロードで同一の文字列を利用する。

- 改行コードは `\n`。
- 発話は `[hh:mm:ss] 話者名` と本文の2行。
- 発話の間には空行を入れる。

## 8. Google Drive OAuth

- `wxt.config.ts` のManifest `oauth2` にChrome拡張機能用OAuth Client IDと `drive.file` を宣言する。
- `GoogleDriveOAuth` はユーザーの `Drive接続` 操作を起点に `chrome.identity.getAuthToken({ interactive: true })` を実行する。
- 定期同期と終了時の同期では `interactive: false` を使い、未認証時に同意画面を表示しない。
- Chrome Identity APIがアクセストークンのキャッシュと更新を管理する。拡張機能はリフレッシュトークンを保存しない。
- Drive APIが401を返したときは、直前のアクセストークンを `removeCachedAuthToken` で破棄し、必要に応じて再取得する。
- EdgeでIdentity APIを利用できない場合は、Google Drive保存の非対応メッセージを表示し、字幕データはIndexedDBへ残す。
