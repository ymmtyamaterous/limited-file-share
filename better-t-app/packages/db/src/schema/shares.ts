import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  (table) => [index("shares_expires_at_idx").on(table.expiresAt)],
);

export const shareTexts = sqliteTable("share_texts", {
  shareId: text("share_id")
    .primaryKey()
    .references(() => shares.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
});

export const shareFiles = sqliteTable("share_files", {
  shareId: text("share_id")
    .primaryKey()
    .references(() => shares.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
});

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
