import { FileIcon, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@better-t-app/ui/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface FileUploadDropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

export function FileUploadDropzone({ onFileSelect, selectedFile }: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        alert("ファイルサイズが50MBを超えています。");
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (selectedFile) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm">
        <FileIcon className="h-4 w-4 flex-shrink-0 text-indigo-500 dark:text-indigo-400" />
        <span className="flex-1 truncate font-medium">{selectedFile.name}</span>
        <span className="flex-shrink-0 text-[0.78rem] text-muted-foreground">
          {formatSize(selectedFile.size)}
        </span>
        <button
          type="button"
          onClick={() => {
            onFileSelect(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors",
        isDragging
          ? "border-indigo-500 bg-indigo-500/5"
          : "border-border hover:border-indigo-500/60 hover:bg-muted/30",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={handleInputChange} />
      {/* 円形アイコン */}
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
        <svg
          className="h-[22px] w-[22px] text-indigo-500 dark:text-indigo-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p className="mb-1 text-[0.9rem] font-semibold">
        ファイルをドロップ、または{" "}
        <span className="text-indigo-600 dark:text-indigo-400">クリックして選択</span>
      </p>
      <p className="text-[0.8rem] text-muted-foreground">
        最大 <span className="font-semibold text-indigo-500 dark:text-indigo-400">50MB</span> まで対応
      </p>
    </div>
  );
}

