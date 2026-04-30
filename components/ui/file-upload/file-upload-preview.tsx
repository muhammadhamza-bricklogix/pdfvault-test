import { Button, Card, Chip } from "@heroui/react";

import { formatFileSize } from "@/lib/shared/utils/file-upload.utils";

type FileUploadPreviewProps = {
  file: File;
  onClear: () => void;
};

function getFileTypeLabel(type: string): string {
  if (type === "application/pdf") return "PDF";
  if (type.includes("spreadsheet") || type.includes("excel")) return "Excel";
  if (type.includes("word") || type.includes("document")) return "DOC";
  if (type.includes("image")) return "Image";

  return "File";
}

export function FileUploadPreview({ file, onClear }: FileUploadPreviewProps) {
  const typeLabel = getFileTypeLabel(file.type);

  return (
    <Card className="w-full max-w-4xl rounded-[2rem] border bg-default-100 p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-[var(--color-accent)] text-sm font-bold text-[var(--color-background)]">
          {typeLabel}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{file.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Chip className="text-xs" size="sm" variant="soft">
              {formatFileSize(file.size)}
            </Chip>
          </div>
        </div>

        <Button
          className="flex-none rounded-full"
          size="sm"
          variant="ghost"
          onPress={onClear}
        >
          Remove
        </Button>
      </div>
    </Card>
  );
}
