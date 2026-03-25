# API 設計書

## 1. 概要

本APIはoRPCを使用して実装される。フロントエンドからはTanStack QueryとoRPCクライアントを通じてアクセスする。  
エンドポイントのベースパスは `/rpc` とし、OpenAPI ドキュメントも `/api/openapi` に公開する。

---

## 2. 共通仕様

### 2.1 認証

- 一般ユーザー向けAPIは認証不要（`publicProcedure`）
- パスキーはリクエストボディで受け渡す
- 削除操作は削除トークンで認可する

### 2.2 エラーレスポンス形式

```ts
{
  code: "NOT_FOUND" | "UNAUTHORIZED" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR",
  message: string
}
```

### 2.3 入力バリデーション

すべての入力はZodスキーマでバリデーションを行う。

---

## 3. エンドポイント一覧

### 3.1 コンテンツ作成

#### `share.create`

ファイルまたはテキストを共有として登録する。

**プロシージャタイプ:** `publicProcedure`  
**HTTPメソッド（OpenAPI）:** `POST /api/share`

**入力:**

```ts
{
  type: "text" | "file",
  // type === "text" の場合
  content?: string,           // テキスト内容（最大1MB）
  // type === "file" の場合
  fileName?: string,          // ファイル名
  mimeType?: string,          // MIMEタイプ
  fileData?: string,          // Base64エンコードされたファイルデータ（最大50MB）
  // 共通
  passkey: string,            // パスキー（4文字以上）
  expiresIn: 3600 | 86400 | 604800 | 2592000,  // 有効期限（秒）
  downloadLimit?: number,     // ダウンロード回数制限（省略時: 無制限）
}
```

**出力:**

```ts
{
  shareId: string,       // 共有ID（8文字のランダム文字列）
  shareUrl: string,      // 共有URL（例: https://example.com/s/abc12345）
  deleteToken: string,   // 削除トークン（UUID。再表示不可）
  expiresAt: string,     // 有効期限（ISO 8601）
}
```

**エラー:**

| コード | 説明 |
|--------|------|
| `BAD_REQUEST` | 入力値が不正（パスキーが短すぎる、ファイルサイズ超過など） |
| `INTERNAL_SERVER_ERROR` | サーバーエラー |

---

### 3.2 コンテンツアクセス（パスキー認証）

#### `share.unlock`

パスキーを検証してコンテンツ情報を返す。

**プロシージャタイプ:** `publicProcedure`  
**HTTPメソッド（OpenAPI）:** `POST /api/share/unlock`

**入力:**

```ts
{
  shareId: string,   // 共有ID
  passkey: string,   // パスキー
}
```

**出力:**

```ts
{
  shareId: string,
  type: "text" | "file",
  // type === "text" の場合
  content?: string,
  // type === "file" の場合
  fileName?: string,
  mimeType?: string,
  fileSize?: number,       // バイト数
  createdAt: string,       // ISO 8601
  expiresAt: string,       // ISO 8601
  downloadCount: number,   // 現在のダウンロード回数
  downloadLimit: number | null,
}
```

**エラー:**

| コード | 説明 |
|--------|------|
| `NOT_FOUND` | 指定された共有IDが存在しない、または期限切れ |
| `UNAUTHORIZED` | パスキーが一致しない |

---

### 3.3 ファイルダウンロード

#### `share.download`

ファイルのダウンロードURLを取得する（またはBase64データを返す）。

**プロシージャタイプ:** `publicProcedure`  
**HTTPメソッド（OpenAPI）:** `POST /api/share/download`

**入力:**

```ts
{
  shareId: string,
  passkey: string,
}
```

**出力:**

```ts
{
  fileName: string,
  mimeType: string,
  fileData: string,   // Base64エンコードされたファイルデータ
}
```

**サイドエフェクト:**

- `downloadCount` をインクリメントする
- `downloadLimit` に達した場合はコンテンツを自動削除する

**エラー:**

| コード | 説明 |
|--------|------|
| `NOT_FOUND` | 指定された共有IDが存在しない、または期限切れ |
| `UNAUTHORIZED` | パスキーが一致しない |
| `BAD_REQUEST` | ダウンロード回数制限に達している |

---

### 3.4 コンテンツ削除

#### `share.delete`

削除トークンを使用してコンテンツを手動削除する。

**プロシージャタイプ:** `publicProcedure`  
**HTTPメソッド（OpenAPI）:** `DELETE /api/share`

**入力:**

```ts
{
  shareId: string,
  deleteToken: string,
}
```

**出力:**

```ts
{
  success: true
}
```

**エラー:**

| コード | 説明 |
|--------|------|
| `NOT_FOUND` | 指定された共有IDが存在しない |
| `UNAUTHORIZED` | 削除トークンが一致しない |

---

### 3.5 コンテンツ情報取得（メタデータのみ）

#### `share.getMeta`

パスキー不要でコンテンツのメタデータ（タイプ・有効期限など）を取得する。  
パスキー入力フォームの表示判定などに使用する。

**プロシージャタイプ:** `publicProcedure`  
**HTTPメソッド（OpenAPI）:** `GET /api/share/{shareId}/meta`

**入力:**

```ts
{
  shareId: string,
}
```

**出力:**

```ts
{
  shareId: string,
  type: "text" | "file",
  fileName?: string,   // ファイル名（typeがfileの場合）
  expiresAt: string,   // ISO 8601
  hasDownloadLimit: boolean,
}
```

**エラー:**

| コード | 説明 |
|--------|------|
| `NOT_FOUND` | 指定された共有IDが存在しない、または期限切れ |

---

### 3.6 ヘルスチェック

#### `healthCheck`

**プロシージャタイプ:** `publicProcedure`

**出力:** `"OK"`

---

## 4. ルーター構成（oRPC）

```ts
export const appRouter = {
  healthCheck: publicProcedure.handler(...),
  share: {
    create:   publicProcedure.input(createShareSchema).handler(...),
    unlock:   publicProcedure.input(unlockShareSchema).handler(...),
    download: publicProcedure.input(downloadShareSchema).handler(...),
    delete:   publicProcedure.input(deleteShareSchema).handler(...),
    getMeta:  publicProcedure.input(getMetaSchema).handler(...),
  },
};
```

---

## 5. レートリミット

| エンドポイント | 制限 |
|----------------|------|
| `share.create` | 10回/分/IP |
| `share.unlock` | 20回/分/IP |
| `share.download` | 20回/分/IP |

レートリミットはHonoのミドルウェアで実装する。

---

## 6. クリーンアップジョブ

バックエンドサーバー起動時およびcron相当の定期実行（1時間ごと）で以下の処理を行う：

1. `expires_at < NOW()` の `shares` レコードを検索
2. 対応するファイルをストレージから削除
3. データベースレコードを削除

実装はHonoのサーバー起動フックまたはBunの`setInterval`を使用する。
