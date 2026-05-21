"use client";

import type { ToolConfig } from "@/lib/shared/constants/tools";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@heroui/react";

import { FileUpload } from "@/components/ui/file-upload";
import { useConvertFileMutation } from "@/lib/client/query/mutations/conversion.mutation";
import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";
import { ROUTES } from "@/lib/shared/constants/routes";

type ToolUploadSectionProps = {
  tool: ToolConfig;
};

// Keyed by tool.slug at the route level — Next.js re-mounts this component
// when the user navigates to a different tool, so per-slug reset isn't
// needed inside the component itself.
export function ToolUploadSection({ tool }: ToolUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const setEditorFile = usePdfEditorStore((s) => s.setFile);
  const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);
  const convert = useConvertFileMutation();

  const isConversionTool = Boolean(tool.conversionType);
  const isPdfInput = tool.accept.includes("application/pdf");

  const handleSelect = (selected: File) => {
    setFile(selected);

    if (isConversionTool && tool.conversionType) {
      convert.mutate({ file: selected, type: tool.conversionType });

      return;
    }

    if (!isPdfInput) return;

    // Non-conversion fallback: open the PDF in the editor (used by future
    // editor-entry-point tools that don't go through CloudConvert).
    setCurrentDocument(null);
    setEditorFile(selected);
    router.push(ROUTES.TOOLS.PDF_EDITOR);
  };

  const handleClear = () => {
    setFile(null);
    convert.reset();
  };

  return (
    <section className="flex w-full flex-col items-center py-4 sm:py-8">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <div className="space-y-4">
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {tool.title}
          </h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-default-500 sm:text-xl">
            {tool.description}
          </p>
        </div>

        <FileUpload
          accept={tool.accept}
          acceptLabel={tool.acceptLabel}
          description={`Upload your ${tool.acceptLabel} file to convert.`}
          file={file}
          heading={`Drop your ${tool.acceptLabel} file here`}
          onFileClear={handleClear}
          onFileSelect={handleSelect}
        />

        {isConversionTool && convert.isPending ? (
          <p
            aria-live="polite"
            className="text-sm text-default-500"
            role="status"
          >
            Converting… this can take up to a minute for larger files.
          </p>
        ) : null}

        {isConversionTool && convert.isSuccess ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-success-600">
              Conversion complete — your download has started.
            </p>
            <Button variant="secondary" onPress={handleClear}>
              Convert another file
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
