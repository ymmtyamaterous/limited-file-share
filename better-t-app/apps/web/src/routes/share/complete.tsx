import { Button } from "@better-t-app/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@better-t-app/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@better-t-app/ui/components/dialog";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ExternalLink, PlusCircle, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

import { CopyButton } from "@/components/copy-button";

interface CompleteState {
  shareId: string;
  shareUrl: string;
  deleteToken: string;
  expiresAt: string;
}

export const Route = createFileRoute("/share/complete")({
  component: ShareCompleteComponent,
});

function ShareCompleteComponent() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const state = routerState.location.state as unknown as CompleteState | undefined;

  // stateが無い場合（リロード等）はホームへリダイレクト
  useEffect(() => {
    if (!state?.shareId) {
      navigate({ to: "/" });
    }
  }, [state, navigate]);

  if (!state?.shareId) return null;

  const expiresDate = new Date(state.expiresAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h1 className="text-2xl font-bold">共有を作成しました！</h1>
        <p className="text-sm text-muted-foreground">
          有効期限: <strong>{expiresDate}</strong> まで
        </p>
      </div>

      <div className="space-y-4">
        {/* 共有URL */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">共有URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted px-3 py-2">
              <p className="break-all font-mono text-sm">{state.shareUrl}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={state.shareUrl} label="URLをコピー" />
              <a href={state.shareUrl} target="_blank" rel="noreferrer">
                <Button type="button" variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  開く
                </Button>
              </a>
              <Dialog>
                <DialogTrigger>
                  <Button type="button" variant="outline" size="sm" className="gap-2">
                    <QrCode className="h-4 w-4" />
                    QRコードを表示
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex flex-col items-center gap-4">
                  <DialogHeader>
                    <DialogTitle>QRコード</DialogTitle>
                  </DialogHeader>
                  <QRCodeSVG value={state.shareUrl} size={220} />
                  <p className="break-all text-center text-xs text-muted-foreground">
                    {state.shareUrl}
                  </p>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* 削除トークン */}
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              削除トークン（一度のみ表示）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted px-3 py-2">
              <p className="break-all font-mono text-sm">{state.deleteToken}</p>
            </div>
            <CopyButton value={state.deleteToken} label="トークンをコピー" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ このトークンは再表示できません。必ずメモしてください。このトークンを使ってコンテンツを手動削除できます。
            </p>
          </CardContent>
        </Card>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate({ to: "/" })}
        >
          <PlusCircle className="h-4 w-4" />
          新しい共有を作成する
        </Button>
      </div>
    </div>
  );
}
