import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@better-t-app/ui/components/button";
import { Input } from "@better-t-app/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock,
  Download,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Paperclip,
  Share2,
  Upload,
} from "lucide-react";
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
  { label: "7日間", value: 604800 },
  { label: "30日間", value: 2592000 },
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
    <div className="mx-auto max-w-[560px] px-5 py-12 pb-20">
      {/* ── Hero ── */}
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
          <KeyRound className="h-3 w-3" />
          No account required
        </div>
        <h1 className="mb-2.5 text-[clamp(1.6rem,5vw,2.25rem)] font-extrabold leading-tight tracking-tight">
          ファイルをすぐに<br />安全に共有する
        </h1>
        <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
          パスキーで保護して、有効期限付きで共有。<br />アカウント登録は一切不要です。
        </p>
      </div>

      {/* ── Card ── */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-md">

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b">
          {(["file", "text"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "flex items-center justify-center gap-1.5 border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors",
                activeTab === tab
                  ? "border-indigo-500 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              ].join(" ")}
            >
              {tab === "file" ? (
                <><Paperclip className="h-[15px] w-[15px]" /> ファイル</>
              ) : (
                <><svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> テキスト</>
              )}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6">

          {/* ── File panel ── */}
          {activeTab === "file" && (
            <FileUploadDropzone onFileSelect={setSelectedFile} selectedFile={selectedFile} />
          )}

          {/* ── Text panel ── */}
          {activeTab === "text" && (
            <div>
              <textarea
                placeholder={"テキストまたはコードスニペットを入力…\n\n最大 1MB まで対応"}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={7}
                className="w-full resize-y rounded-lg border bg-background px-3.5 py-3 font-mono text-sm leading-relaxed placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
              />
              <p className="mt-1 text-right text-[0.75rem] text-muted-foreground">
                {new TextEncoder().encode(textContent).length.toLocaleString()} / 1,048,576 bytes
              </p>
            </div>
          )}

          {/* ── Divider ── */}
          <hr className="border-border" />

          {/* ── Passkey + Expiry row ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Passkey */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passkey" className="flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-wide text-muted-foreground">
                <KeyRound className="h-3 w-3" />
                パスキー
              </label>
              <div className="relative">
                <input
                  id="passkey"
                  type={showPasskey ? "text" : "password"}
                  placeholder="4文字以上"
                  autoComplete="off"
                  {...register("passkey")}
                  className="w-full rounded-lg border bg-background px-3 py-[0.55rem] pr-9 text-sm placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.passkey && (
                <p className="text-[0.75rem] text-destructive">{errors.passkey.message}</p>
              )}
            </div>

            {/* Expiry */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="expiresIn" className="flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3 w-3" />
                有効期限
              </label>
              <select
                id="expiresIn"
                value={expiresIn}
                onChange={(e) => setValue("expiresIn", Number(e.target.value) as FormValues["expiresIn"])}
                className="w-full appearance-none rounded-lg border bg-background px-3 py-[0.55rem] pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.55rem center",
                }}
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Download limit ── */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="downloadLimit" className="flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-wide text-muted-foreground">
              <Download className="h-3 w-3" />
              ダウンロード回数制限
              <span className="normal-case tracking-normal font-normal text-[0.75rem] text-muted-foreground/70">（省略可）</span>
            </label>
            <input
              id="downloadLimit"
              type="number"
              min={1}
              step={1}
              placeholder="例: 10"
              {...register("downloadLimit")}
              className="w-full rounded-lg border bg-background px-3 py-[0.55rem] text-sm placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
            />
            {errors.downloadLimit && (
              <p className="text-[0.75rem] text-destructive">{errors.downloadLimit.message}</p>
            )}
          </div>

          {/* ── Info banner ── */}
          <div className="flex items-start gap-2 rounded-lg border border-indigo-400/20 bg-indigo-500/8 px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-muted-foreground">
            <Info className="mt-px h-3.5 w-3.5 flex-shrink-0 text-indigo-500 dark:text-indigo-400" />
            共有URLと削除トークンは作成後に一度だけ表示されます。大切に保管してください。
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-[0.9rem] font-bold text-white shadow-[0_2px_8px_rgba(99,102,241,0.35)] transition hover:-translate-y-px hover:bg-indigo-700 hover:shadow-[0_4px_14px_rgba(99,102,241,0.45)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> 作成中...</>
            ) : (
              <><Share2 className="h-4 w-4" /> 共有リンクを作成する</>
            )}
          </button>

          {createMutation.isError && (
            <p className="text-center text-sm text-destructive">
              エラーが発生しました: {createMutation.error?.message}
            </p>
          )}
        </form>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-10 flex flex-col items-center gap-1.5 text-[0.78rem] text-muted-foreground/60">
        <div className="flex gap-3">
          <a href="#" className="hover:text-muted-foreground transition-colors">利用規約</a>
          <span>·</span>
          <a href="#" className="hover:text-muted-foreground transition-colors">プライバシーポリシー</a>
        </div>
        <div>© 2026 Limited File Share</div>
      </footer>
    </div>
  );
}
