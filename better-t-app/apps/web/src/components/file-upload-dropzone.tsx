import { FileUp, X } from "lucide-react";
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
        alert("ファイルサイズが上限（50MB）を超えています");
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

  return (
    <div>
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">ドラッグ＆ドロップ</p>
        <p className="mt-1 text-xs text-muted-foreground">
          またはクリックでファイルを選択（最大 50MB）
        </p>
        <input ref={inputRef} type="file" className="hidden" onChange={handleInputChange} />
      </div>

      {selectedFile && (
        <div className="mt-3 flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="ml-2 rounded p-1 hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
