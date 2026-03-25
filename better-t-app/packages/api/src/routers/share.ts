import { db } from "@better-t-app/db";
import {
  shareFiles,
  shareTexts,
  shares,
} from "@better-t-app/db/schema/shares";
import { env } from "@better-t-app/env/server";
import { ORPCError } from "@orpc/server";
import bcryptjs from "bcryptjs";
import { eq, lt } from "drizzle-orm";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { publicProcedure } from "../index";

// ──────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────

/** 8文字のランダム英数字IDを生成する */
function generateShareId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/** 期限切れコンテンツのクリーンアップ */
export async function cleanupExpiredShares(): Promise<void> {
  const now = new Date();
  const expired = await db
    .select({ id: shares.id })
    .from(shares)
    .where(lt(shares.expiresAt, now));

  for (const { id } of expired) {
    // ファイルがある場合は削除
    const fileRecord = await db
      .select()
      .from(shareFiles)
      .where(eq(shareFiles.shareId, id))
      .get();
    if (fileRecord) {
      const dir = join(env.UPLOAD_DIR, id);
      await rm(dir, { recursive: true, force: true });
    }
    await db.delete(shares).where(eq(shares.id, id));
  }

  if (expired.length > 0) {
    console.log(`[cleanup] ${expired.length} 件の期限切れ共有を削除しました`);
  }
}

// ──────────────────────────────────────────────────────────
// スキーマ
// ──────────────────────────────────────────────────────────

const createShareSchema = z
  .object({
    type: z.enum(["text", "file"]),
    content: z.string().max(1_048_576).optional(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
    fileData: z.string().optional(), // Base64
    passkey: z.string().min(4),
    expiresIn: z.union([
      z.literal(3600),
      z.literal(86400),
      z.literal(604800),
      z.literal(2592000),
    ]),
    downloadLimit: z.number().int().min(1).optional(),
  })
  .refine(
    (d) => {
      if (d.type === "text") return typeof d.content === "string" && d.content.length > 0;
      if (d.type === "file")
        return (
          typeof d.fileName === "string" &&
          typeof d.mimeType === "string" &&
          typeof d.fileData === "string"
        );
      return false;
    },
    { message: "typeに応じた必須フィールドが不足しています" },
  );

const unlockShareSchema = z.object({
  shareId: z.string(),
  passkey: z.string(),
});

const downloadShareSchema = z.object({
  shareId: z.string(),
  passkey: z.string(),
});

const deleteShareSchema = z.object({
  shareId: z.string(),
  deleteToken: z.string(),
});

const getMetaSchema = z.object({
  shareId: z.string(),
});

// ──────────────────────────────────────────────────────────
// 共通: 期限切れ/存在チェック
// ──────────────────────────────────────────────────────────

async function getActiveShare(shareId: string) {
  const share = await db
    .select()
    .from(shares)
    .where(eq(shares.id, shareId))
    .get();

  if (!share) throw new ORPCError("NOT_FOUND", { message: "この共有は存在しないか期限切れです" });
  if (share.expiresAt < new Date())
    throw new ORPCError("NOT_FOUND", { message: "この共有は存在しないか期限切れです" });

  return share;
}

async function verifyPasskey(share: { passkeyHash: string }, passkey: string) {
  const ok = await bcryptjs.compare(passkey, share.passkeyHash);
  if (!ok) throw new ORPCError("UNAUTHORIZED", { message: "パスキーが正しくありません" });
}

// ──────────────────────────────────────────────────────────
// share.create
// ──────────────────────────────────────────────────────────

export const shareCreate = publicProcedure
  .input(createShareSchema)
  .handler(async ({ input }) => {
    // ファイルサイズチェック (50MB)
    if (input.type === "file" && input.fileData) {
      const fileSizeBytes = Math.ceil((input.fileData.length * 3) / 4);
      if (fileSizeBytes > 52_428_800) {
        throw new ORPCError("BAD_REQUEST", { message: "ファイルサイズが上限（50MB）を超えています" });
      }
    }

    const shareId = generateShareId();
    const passkeyHash = await bcryptjs.hash(input.passkey, 10);
    const deleteToken = uuidv4();
    const expiresAt = new Date(Date.now() + input.expiresIn * 1000);

    await db.insert(shares).values({
      id: shareId,
      type: input.type,
      passkeyHash,
      deleteToken,
      expiresAt,
      downloadLimit: input.downloadLimit ?? null,
      downloadCount: 0,
    });

    if (input.type === "text" && input.content) {
      await db.insert(shareTexts).values({ shareId, content: input.content });
    } else if (
      input.type === "file" &&
      input.fileData &&
      input.fileName &&
      input.mimeType
    ) {
      const uploadDir = join(env.UPLOAD_DIR, shareId);
      await mkdir(uploadDir, { recursive: true });
      const storagePath = join(uploadDir, input.fileName);
      await writeFile(storagePath, Buffer.from(input.fileData, "base64"));
      const fileSizeBytes = Buffer.from(input.fileData, "base64").length;

      await db.insert(shareFiles).values({
        shareId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: fileSizeBytes,
        storagePath,
      });
    }

    return {
      shareId,
      shareUrl: `${env.BASE_URL}/s/${shareId}`,
      deleteToken,
      expiresAt: expiresAt.toISOString(),
    };
  });

// ──────────────────────────────────────────────────────────
// share.unlock
// ──────────────────────────────────────────────────────────

export const shareUnlock = publicProcedure
  .input(unlockShareSchema)
  .handler(async ({ input }) => {
    const share = await getActiveShare(input.shareId);
    await verifyPasskey(share, input.passkey);

    let content: string | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;

    if (share.type === "text") {
      const textRecord = await db
        .select()
        .from(shareTexts)
        .where(eq(shareTexts.shareId, share.id))
        .get();
      content = textRecord?.content;
    } else {
      const fileRecord = await db
        .select()
        .from(shareFiles)
        .where(eq(shareFiles.shareId, share.id))
        .get();
      fileName = fileRecord?.fileName;
      mimeType = fileRecord?.mimeType;
      fileSize = fileRecord?.fileSize;
    }

    return {
      shareId: share.id,
      type: share.type,
      content,
      fileName,
      mimeType,
      fileSize,
      createdAt: share.createdAt.toISOString(),
      expiresAt: share.expiresAt.toISOString(),
      downloadCount: share.downloadCount,
      downloadLimit: share.downloadLimit,
    };
  });

// ──────────────────────────────────────────────────────────
// share.download
// ──────────────────────────────────────────────────────────

export const shareDownload = publicProcedure
  .input(downloadShareSchema)
  .handler(async ({ input }) => {
    const share = await getActiveShare(input.shareId);
    await verifyPasskey(share, input.passkey);

    if (share.type !== "file") {
      throw new ORPCError("BAD_REQUEST", { message: "この共有はファイルではありません" });
    }

    if (
      share.downloadLimit !== null &&
      share.downloadLimit !== undefined &&
      share.downloadCount >= share.downloadLimit
    ) {
      throw new ORPCError("BAD_REQUEST", { message: "ダウンロード回数制限に達しています" });
    }

    const fileRecord = await db
      .select()
      .from(shareFiles)
      .where(eq(shareFiles.shareId, share.id))
      .get();

    if (!fileRecord) {
      throw new ORPCError("NOT_FOUND", { message: "ファイルが見つかりません" });
    }

    // ダウンロードカウントをインクリメント
    const newCount = share.downloadCount + 1;
    await db
      .update(shares)
      .set({ downloadCount: newCount })
      .where(eq(shares.id, share.id));

    // ダウンロード上限に達したら削除
    if (share.downloadLimit !== null && share.downloadLimit !== undefined && newCount >= share.downloadLimit) {
      await rm(join(env.UPLOAD_DIR, share.id), { recursive: true, force: true });
      await db.delete(shares).where(eq(shares.id, share.id));
    }

    const fileBuffer = await readFile(fileRecord.storagePath);
    const fileData = fileBuffer.toString("base64");

    return {
      fileName: fileRecord.fileName,
      mimeType: fileRecord.mimeType,
      fileData,
    };
  });

// ──────────────────────────────────────────────────────────
// share.delete
// ──────────────────────────────────────────────────────────

export const shareDelete = publicProcedure
  .input(deleteShareSchema)
  .handler(async ({ input }) => {
    const share = await db
      .select()
      .from(shares)
      .where(eq(shares.id, input.shareId))
      .get();

    if (!share) throw new ORPCError("NOT_FOUND", { message: "この共有は存在しません" });
    if (share.deleteToken !== input.deleteToken)
      throw new ORPCError("UNAUTHORIZED", { message: "削除トークンが正しくありません" });

    if (share.type === "file") {
      await rm(join(env.UPLOAD_DIR, share.id), { recursive: true, force: true });
    }
    await db.delete(shares).where(eq(shares.id, share.id));

    return { success: true as const };
  });

// ──────────────────────────────────────────────────────────
// share.getMeta
// ──────────────────────────────────────────────────────────

export const shareGetMeta = publicProcedure
  .input(getMetaSchema)
  .handler(async ({ input }) => {
    const share = await getActiveShare(input.shareId);

    let fileName: string | undefined;
    if (share.type === "file") {
      const fileRecord = await db
        .select({ fileName: shareFiles.fileName })
        .from(shareFiles)
        .where(eq(shareFiles.shareId, share.id))
        .get();
      fileName = fileRecord?.fileName;
    }

    return {
      shareId: share.id,
      type: share.type,
      fileName,
      expiresAt: share.expiresAt.toISOString(),
      hasDownloadLimit: share.downloadLimit !== null && share.downloadLimit !== undefined,
    };
  });
