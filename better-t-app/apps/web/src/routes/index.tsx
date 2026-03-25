import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@better-t-app/ui/components/button";
import { Input } from "@better-t-app/ui/components/input";
import { Label } from "@better-t-app/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@better-t-app/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@better-t-app/ui/components/tabs";
import { Textarea } from "@better-t-app/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FileUploadDropzone } from "@/components/file-upload-dropzone";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const EXPIRY_OPTIONS = [
  { label: "1時間", value: 3600 },
  { label: "1日", value: 86400 },
  { label: "7日", value: 604800 },
  { label: "30日", value: 2592000 },
] as const;

const formSchema = z.object({
  passkey: z.string().min(4, "パスキーは4文字以上必要です"),
  expiresIn: z.union([
    z.literal(3600),
    z.literal(86400),
    z.literal(604800),
    z.literal(2592000),
  ]),
  downloadLimit: z
    .string()
    .optional()
    .refine(
      (v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1),
      "1以上の整数を入力してください",
    ),
});

type FormValues = z.infer<typeof formSchema>;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function HomeComponent() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expiresIn: 86400,
      passkey: "",
      downloadLimit: "",
    },
  });

  const expiresIn = watch("expiresIn");

  const createMutation = useMutation(orpc.share.create.mutationOptions());

  const onSubmit = async (values: FormValues) => {
    if (activeTab === "file") {
      if (!selectedFile) {
        alert("ファイルを選択してください");
        return;
      }
      const fileData = await fileToBase64(selectedFile);
      const result = await createMutation.mutateAsync({
        type: "file",
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        fileData,
        passkey: values.passkey,
        expiresIn: values.expiresIn,
        downloadLimit: values.downloadLimit ? Number(values.downloadLimit) : undefined,
      });
      navigate({ to: "/share/complete", state: result });
    } else {
      if (!textContent.trim()) {
        alert("テキストを入力してください");
        return;
      }
      if (new TextEncoder().encode(textContent).length > 1_048_576) {
        alert("テキストサイズが上限（1MB）を超えています");
        return;
      }
      const result = await createMutation.mutateAsync({
        type: "text",
        content: textContent,
        passkey: values.passkey,
        expiresIn: values.expiresIn,
        downloadLimit: values.downloadLimit ? Number(values.downloadLimit) : undefined,
      });
      navigate({ to: "/share/complete", state: result });
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Limited File Share</h1>
        <p className="mt-2 text-muted-foreground">ファイルやテキストを簡単・安全に共有</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "file" | "text")}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="file" className="flex-1">
                ファイル
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                テキスト
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file">
              <FileUploadDropzone onFileSelect={setSelectedFile} selectedFile={selectedFile} />
            </TabsContent>

            <TabsContent value="text">
              <Textarea
                placeholder="テキストまたはコードを入力..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                className="font-mono text-sm resize-y"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {new TextEncoder().encode(textContent).length.toLocaleString()} / 1,048,576 bytes
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          {/* パスキー */}
          <div className="space-y-1.5">
            <Label htmlFor="passkey">パスキー</Label>
            <div className="relative">
              <Input
                id="passkey"
                type={showPasskey ? "text" : "password"}
                placeholder="4文字以上のパスキー"
                {...register("passkey")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasskey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.passkey && (
              <p className="text-xs text-destructive">{errors.passkey.message}</p>
            )}
          </div>

          {/* 有効期限 */}
          <div className="space-y-1.5">
            <Label>有効期限</Label>
            <Select
              value={expiresIn}
              onValueChange={(v) => setValue("expiresIn", Number(v) as FormValues["expiresIn"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {EXPIRY_OPTIONS.find((o) => o.value === expiresIn)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ダウンロード回数制限 */}
          <div className="space-y-1.5">
            <Label htmlFor="downloadLimit">
              ダウンロード回数制限{" "}
              <span className="text-muted-foreground">(省略可)</span>
            </Label>
            <Input
              id="downloadLimit"
              type="number"
              min={1}
              placeholder="例: 5"
              {...register("downloadLimit")}
            />
            {errors.downloadLimit && (
              <p className="text-xs text-destructive">{errors.downloadLimit.message}</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full gap-2"
          size="lg"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              作成中...
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              共有を作成する
            </>
          )}
        </Button>

        {createMutation.isError && (
          <p className="text-center text-sm text-destructive">
            エラーが発生しました: {createMutation.error?.message}
          </p>
        )}
      </form>
    </div>
  );
}
