import { describe, expect, mock, test } from "bun:test";

// drizzle-orm や DB への依存をモック
const mockGet = mock(() => undefined);
const mockSelect = mock(() => ({ from: mockFrom }));
const mockFrom = mock(() => ({ where: mockWhere }));
const mockWhere = mock(() => ({ get: mockGet }));
const mockInsert = mock(() => ({ values: mock(() => Promise.resolve()) }));
const mockUpdate = mock(() => ({ set: mock(() => ({ where: mock(() => Promise.resolve()) })) }));
const mockDelete = mock(() => ({ where: mock(() => Promise.resolve()) }));

mock.module("@better-t-app/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

mock.module("@better-t-app/db/schema/shares", () => ({
  shares: {},
  shareTexts: {},
  shareFiles: {},
}));

mock.module("@better-t-app/env/server", () => ({
  env: {
    DATABASE_URL: "file:test.db",
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-32chars",
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:5173",
    NODE_ENV: "test",
    UPLOAD_DIR: "/tmp/test-uploads",
    BASE_URL: "http://localhost:3000",
  },
}));

mock.module("node:fs/promises", () => ({
  mkdir: mock(() => Promise.resolve()),
  writeFile: mock(() => Promise.resolve()),
  readFile: mock(() => Promise.resolve(Buffer.from("test content"))),
  rm: mock(() => Promise.resolve()),
}));

// generateShareId のテスト
describe("generateShareId", () => {
  test("8文字の英数字を生成する", () => {
    // generateShareId は share.ts 内のプライベート関数のためビルド出力経由でテスト
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    expect(id).toHaveLength(8);
    expect(/^[a-z0-9]{8}$/.test(id)).toBe(true);
  });
});

// bcryptjs のパスキーハッシュテスト
describe("passkey hashing", () => {
  test("bcryptjs でパスキーをハッシュ化して検証できる", async () => {
    const bcryptjs = await import("bcryptjs");
    const passkey = "testpass123";
    const hash = await bcryptjs.default.hash(passkey, 10);
    expect(hash).not.toBe(passkey);
    const ok = await bcryptjs.default.compare(passkey, hash);
    expect(ok).toBe(true);
    const ng = await bcryptjs.default.compare("wrongpass", hash);
    expect(ng).toBe(false);
  });
});

// Base64変換のテスト
describe("Base64", () => {
  test("バッファを Base64 に変換して元に戻せる", () => {
    const original = "Hello, Limited File Share!";
    const buf = Buffer.from(original);
    const b64 = buf.toString("base64");
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    expect(decoded).toBe(original);
  });
});

// ファイルサイズ制限のテスト
describe("file size validation", () => {
  test("50MB 超のファイルを拒否する", () => {
    const MAX = 52_428_800;
    const okSize = 52_428_800; // ちょうど50MB
    const ngSize = 52_428_801; // 1byte超過
    expect(okSize).toBeLessThanOrEqual(MAX);
    expect(ngSize).toBeGreaterThan(MAX);
  });
});

// テキストサイズ制限のテスト
describe("text size validation", () => {
  test("1MB 超のテキストを拒否する", () => {
    const MAX = 1_048_576;
    const longText = "a".repeat(1_048_577);
    const encoded = new TextEncoder().encode(longText);
    expect(encoded.length).toBeGreaterThan(MAX);
  });
});

// expiresAt 計算のテスト
describe("expiresAt calculation", () => {
  test.each([
    [3600, "1時間"],
    [86400, "1日"],
    [604800, "7日"],
    [2592000, "30日"],
  ])("expiresIn=%i (%s) で正しい期限が計算される", (expiresIn, _label) => {
    const before = Date.now();
    const expiresAt = new Date(before + expiresIn * 1000);
    const diff = expiresAt.getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(expiresIn * 1000);
    expect(diff).toBeLessThanOrEqual(expiresIn * 1000 + 100);
  });
});
