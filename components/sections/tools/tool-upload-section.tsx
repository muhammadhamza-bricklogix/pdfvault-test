"use client";

import type { ToolConfig } from "@/lib/shared/constants/tools";

import { Download01Icon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FileUpload } from "@/components/ui/file-upload";
import { useConvertFileMutation } from "@/lib/client/query/mutations/conversion.mutation";
import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";
import { ROUTES } from "@/lib/shared/constants/routes";
import { triggerBlobDownload } from "@/lib/shared/utils/download";

type ToolUploadSectionProps = {
  tool: ToolConfig;
};

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
    convert.reset();

    if (isConversionTool) return;

    if (!isPdfInput) return;

    setCurrentDocument(null);
    setEditorFile(selected);
    router.push(ROUTES.TOOLS.PDF_EDITOR);
  };

  const handleClear = () => {
    setFile(null);
    convert.reset();
  };

  const handleConvert = () => {
    if (!file || !tool.conversionType) return;
    convert.mutate({ file, type: tool.conversionType });
  };

  const handleDownload = () => {
    if (!convert.data) return;
    triggerBlobDownload(convert.data.blob, convert.data.fileName);
  };

  const showConvertButton =
    isConversionTool &&
    Boolean(file) &&
    !convert.isPending &&
    !convert.isSuccess;
  const showDownloadButton = isConversionTool && convert.isSuccess;

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

        {showConvertButton ? (
          <Button onPress={handleConvert}>Convert</Button>
        ) : null}

        {isConversionTool && convert.isPending ? (
          <p
            aria-live="polite"
            className="text-sm text-default-500"
            role="status"
          >
            Converting… this can take up to a minute for larger files.
          </p>
        ) : null}

        {showDownloadButton ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-success-600">
              Conversion complete — your file is ready.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onPress={handleDownload}>
                <HugeiconsIcon icon={Download01Icon} size={16} />
                Download
              </Button>
              <Button variant="secondary" onPress={handleClear}>
                <HugeiconsIcon icon={Refresh01Icon} size={16} />
                Convert another file
              </Button>
            </div>
          </div>
        ) : null}

        {isConversionTool && convert.isError ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-danger-600">
              Conversion failed. Please try again.
            </p>
            <Button onPress={handleConvert}>Retry</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
