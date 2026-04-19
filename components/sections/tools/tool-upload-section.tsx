"use client";

import type { ToolConfig } from "@/lib/shared/constants/tools";

import { useState } from "react";

import { FileUpload } from "@/components/ui/file-upload";

type ToolUploadSectionProps = {
  tool: ToolConfig;
};

export function ToolUploadSection({ tool }: ToolUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <section className="flex w-full flex-col items-center py-4 sm:py-8">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <div className="space-y-4">
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {tool.title}
          </h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-[var(--app-muted)] sm:text-xl">
            {tool.description}
          </p>
        </div>

        <FileUpload
          accept={tool.accept}
          acceptLabel={tool.acceptLabel}
          description={`Upload your ${tool.acceptLabel} file to convert.`}
          file={file}
          heading={`Drop your ${tool.acceptLabel} file here`}
          onFileClear={() => setFile(null)}
          onFileSelect={setFile}
        />
      </div>
    </section>
  );
}
