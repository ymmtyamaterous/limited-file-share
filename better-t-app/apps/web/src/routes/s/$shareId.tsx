import { Button } from "@better-t-app/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@better-t-app/ui/components/card";
import { Input } from "@better-t-app/ui/components/input";
import { Label } from "@better-t-app/ui/components/label";
import { Skeleton } from "@better-t-app/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  File,
  FileText,
  Lock,
  Loader2,
} from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/s/$shareId")({
  component: ShareAccessComponent,
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ShareAccessComponent() {
  const { shareId } = Route.useParams();
  const [passkey, setPasskey] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [unlockedData, setUnlockedData] = useState<{
    type: "text" | "file";
    content?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    expiresAt: string;
    downloadCount: number;
    downloadLimit: number | null;
  } | null>(null);

  // メタデータ取得
  const metaQuery = useQuery(
    orpc.share.getMeta.queryOptions({ input: { shareId } }),
  );

  // パスキー送信
  const unlockMutation = useMutation(orpc.share.unlock.mutationOptions());

  // ダウンロード
  const downloadMutation = useMutation(orpc.share.download.mutationOptions());

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await unlockMutation.mutateAsync({ shareId, passkey });
    setUnlockedData({
      type: result.type,
      content: result.content,
      fileName: result.fileName,
      mimeType: result.mimeType,
      fileSize: result.fileSize,
      expiresAt: result.expiresAt,
      downloadCount: result.downloadCount,
      downloadLimit: result.downloadLimit,
    });
  };

  const handleDownload = async () => {
    const result = await downloadMutation.mutateAsync({ shareId, passkey });
    const byteChars = atob(result.fileData);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ローディング中
  if (metaQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-10 space-y-4">
        <Skeleton className="h-8 w-1/2 mx-auto" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // 存在しない / 期限切れ
  if (metaQuery.isError || !metaQuery.data) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-10">
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-medium">この共有は存在しないか期限切れです</p>
            <p className="text-sm text-muted-foreground">
              URLが正しいかご確認ください。共有が期限切れになっている可能性があります。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const meta = metaQuery.data;
  const expiresDate = new Date(meta.expiresAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // アンロック済み: コンテンツ表示
  if (unlockedData) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-10 space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <h1 className="text-xl font-bold">アクセス成功</h1>
          <p className="text-xs text-muted-foreground">有効期限: {expiresDate} まで</p>
        </div>

        {unlockedData.type === "text" ? (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                テキストコンテンツ
              </CardTitle>
              {unlockedData.content && <CopyButton value={unlockedData.content} label="テキストをコピー" />}
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-sm whitespace-pre-wrap break-words">
                {unlockedData.content}
              </pre>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <File className="h-4 w-4" />
                ファイル
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 画像プレビュー */}
              {unlockedData.mimeType?.startsWith("image/") && (
                <div className="rounded-md overflow-hidden border">
                  <img
                    src={`data:${unlockedData.mimeType};base64,`}
                    alt={unlockedData.fileName}
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              )}
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16">ファイル名</dt>
                  <dd className="font-medium break-all">{unlockedData.fileName}</dd>
                </div>
                {unlockedData.fileSize !== undefined && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-16">サイズ</dt>
                    <dd>{formatBytes(unlockedData.fileSize)}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-16">種別</dt>
                  <dd className="font-mono text-xs">{unlockedData.mimeType}</dd>
                </div>
                {unlockedData.downloadLimit !== null && unlockedData.downloadLimit !== undefined && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-16">残回数</dt>
                    <dd>{unlockedData.downloadLimit - unlockedData.downloadCount} 回</dd>
                  </div>
                )}
              </dl>
              <Button
                type="button"
                className="w-full gap-2"
                onClick={handleDownload}
                disabled={downloadMutation.isPending}
              >
                {downloadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    ダウンロード中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    ファイルをダウンロード
                  </>
                )}
              </Button>
              {downloadMutation.isError && (
                <p className="text-xs text-destructive text-center">
                  {downloadMutation.error?.message}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // パスキー入力フォーム
  return (
    <div className="container mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">コンテンツへのアクセス</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <dl className="space-y-1 text-sm">
            {meta.type === "file" && meta.fileName && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">ファイル名</dt>
                <dd className="font-medium">{meta.fileName}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">種別</dt>
              <dd>{meta.type === "file" ? "ファイル" : "テキスト"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">有効期限</dt>
              <dd>{expiresDate} まで</dd>
            </div>
            {meta.hasDownloadLimit && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">回数制限</dt>
                <dd>あり</dd>
              </div>
            )}
          </dl>

          <form onSubmit={handleUnlock} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="passkey">パスキーを入力してください</Label>
              <div className="relative">
                <Input
                  id="passkey"
                  type={showPasskey ? "text" : "password"}
                  placeholder="パスキー"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {unlockMutation.isError && (
              <p className="text-xs text-destructive">
                {unlockMutation.error?.message ?? "パスキーが正しくありません"}
              </p>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={unlockMutation.isPending}
            >
              {unlockMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  確認中...
                </>
              ) : (
                "アクセスする"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
