# データベース設計書

## 1. 概要

- **DBMS:** SQLite
- **ORM:** Drizzle ORM
- **ファイルパス:** `packages/db/src/schema/`
- **マイグレーション:** `drizzle-kit` を使用

既存の `auth` 関連テーブル（`user`, `session`, `account`, `verification`）は変更しない。  
本仕様書ではファイル共有機能のために追加するテーブルを定義する。

---

## 2. テーブル一覧

| テーブル名 | 説明 |
|------------|------|
| `user` | （既存）管理者ユーザー |
| `session` | （既存）セッション |
| `account` | （既存）OAuth/パスワードアカウント |
| `verification` | （既存）メール確認トークン |
| `shares` | 共有コンテンツのメタデータ |
| `share_files` | アップロードされたファイルの情報 |

---

## 3. テーブル定義

### 3.1 `shares` テーブル

共有コンテンツのメタデータを管理する。

```sql
CREATE TABLE shares (
  id              TEXT      PRIMARY KEY,             -- 共有ID（8文字のランダム文字列）
  type            TEXT      NOT NULL,                -- "text" | "file"
  passkey_hash    TEXT      NOT NULL,                -- bcryptハッシュ化されたパスキー
  delete_token    TEXT      NOT NULL UNIQUE,         -- 削除トークン（UUID）
  expires_at      INTEGER   NOT NULL,                -- 有効期限（UNIXタイムスタンプ ms）
  download_limit  INTEGER,                           -- ダウンロード回数制限（NULL = 無制限）
  download_count  INTEGER   NOT NULL DEFAULT 0,      -- 現在のダウンロード回数
  created_at      INTEGER   NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at      INTEGER   NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
);
```

**Drizzle スキーマ定義:**

```ts
export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["text", "file"] }).notNull(),
    passkeyHash: text("passkey_hash").notNull(),
    deleteToken: text("delete_token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    downloadLimit: integer("download_limit"),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("shares_expires_at_idx").on(table.expiresAt),
  ],
);
```

**カラム詳細:**

| カラム名 | 型 | 必須 | 説明 |
|----------|----|------|------|
| `id` | TEXT | ✓ | 共有ID（例: `abc12345`）。URLに使用するため8文字のランダム英数字 |
| `type` | TEXT | ✓ | コンテンツ種別: `"text"` または `"file"` |
| `passkey_hash` | TEXT | ✓ | bcryptでハッシュ化したパスキー |
| `delete_token` | TEXT | ✓ | 削除用トークン（UUID v4）。一度のみ発行 |
| `expires_at` | INTEGER | ✓ | 有効期限のUNIXタイムスタンプ（ミリ秒） |
| `download_limit` | INTEGER | - | ダウンロード回数の上限。NULLは無制限 |
| `download_count` | INTEGER | ✓ | 累積ダウンロード回数（デフォルト: 0） |
| `created_at` | INTEGER | ✓ | 作成日時 |
| `updated_at` | INTEGER | ✓ | 更新日時 |

---

### 3.2 `share_texts` テーブル

テキスト/コードスニペットのコンテンツを管理する。

```sql
CREATE TABLE share_texts (
  share_id   TEXT  PRIMARY KEY  REFERENCES shares(id) ON DELETE CASCADE,
  content    TEXT  NOT NULL     -- テキスト内容（最大1MB）
);
```

**Drizzle スキーマ定義:**

```ts
export const shareTexts = sqliteTable("share_texts", {
  shareId: text("share_id")
    .primaryKey()
    .references(() => shares.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
});
```

**カラム詳細:**

| カラム名 | 型 | 必須 | 説明 |
|----------|----|------|------|
| `share_id` | TEXT | ✓ | `shares.id` への外部キー（1対1） |
| `content` | TEXT | ✓ | 共有するテキスト内容 |

---

### 3.3 `share_files` テーブル

アップロードされたファイルのメタデータを管理する。実ファイルはサーバーのローカルファイルシステムに保存する。

```sql
CREATE TABLE share_files (
  share_id      TEXT     PRIMARY KEY  REFERENCES shares(id) ON DELETE CASCADE,
  file_name     TEXT     NOT NULL,    -- 元のファイル名
  mime_type     TEXT     NOT NULL,    -- MIMEタイプ
  file_size     INTEGER  NOT NULL,    -- バイト単位のファイルサイズ
  storage_path  TEXT     NOT NULL     -- サーバー上の保存パス
);
```

**Drizzle スキーマ定義:**

```ts
export const shareFiles = sqliteTable("share_files", {
  shareId: text("share_id")
    .primaryKey()
    .references(() => shares.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
});
```

**カラム詳細:**

| カラム名 | 型 | 必須 | 説明 |
|----------|----|------|------|
| `share_id` | TEXT | ✓ | `shares.id` への外部キー（1対1） |
| `file_name` | TEXT | ✓ | 元のファイル名（例: `document.pdf`） |
| `mime_type` | TEXT | ✓ | MIMEタイプ（例: `application/pdf`） |
| `file_size` | INTEGER | ✓ | ファイルサイズ（バイト） |
| `storage_path` | TEXT | ✓ | サーバーローカルの保存パス（例: `uploads/abc12345/document.pdf`） |

---

## 4. リレーション定義

```
shares 1 ─── 0..1 share_texts
shares 1 ─── 0..1 share_files
```

- `shares.type === "text"` のとき `share_texts` にレコードが存在する
- `shares.type === "file"` のとき `share_files` にレコードが存在する

**Drizzle リレーション定義:**

```ts
export const sharesRelations = relations(shares, ({ one }) => ({
  text: one(shareTexts, {
    fields: [shares.id],
    references: [shareTexts.shareId],
  }),
  file: one(shareFiles, {
    fields: [shares.id],
    references: [shareFiles.shareId],
  }),
}));

export const shareTextsRelations = relations(shareTexts, ({ one }) => ({
  share: one(shares, {
    fields: [shareTexts.shareId],
    references: [shares.id],
  }),
}));

export const shareFilesRelations = relations(shareFiles, ({ one }) => ({
  share: one(shares, {
    fields: [shareFiles.shareId],
    references: [shares.id],
  }),
}));
```

---

## 5. インデックス設計

| テーブル | インデックス | カラム | 目的 |
|----------|-------------|--------|------|
| `shares` | `shares_expires_at_idx` | `expires_at` | クリーンアップジョブで期限切れレコードを高速検索 |
| `shares` | `shares_delete_token_idx`（UNIQUE制約で自動生成） | `delete_token` | 削除トークンによる検索 |

---

## 6. ファイルストレージ設計

ファイルはサーバーのローカルファイルシステムに保存する。

```
{SERVER_ROOT}/
  uploads/
    {shareId}/
      {originalFileName}
```

- ディレクトリ名に共有IDを使用することで衝突を防ぐ
- コンテンツ削除時（手動・期限切れ・ダウンロード上限到達）にディレクトリごと削除する

---

## 7. クリーンアップ処理

```sql
-- 期限切れの shares を検索
SELECT id FROM shares WHERE expires_at < strftime('%s', 'now') * 1000;
```

1. 上記クエリで期限切れのIDを取得
2. 各IDに対してファイルをストレージから削除（`share_files.storage_path` 参照）
3. `DELETE FROM shares WHERE id = ?`（CASCADEで `share_texts`, `share_files` も削除）

---

## 8. マイグレーション管理

`packages/db/drizzle.config.ts` の設定に従い `drizzle-kit` を使用する。

```bash
# マイグレーションファイル生成
cd packages/db && bunx drizzle-kit generate

# マイグレーション実行
cd packages/db && bunx drizzle-kit migrate
```
