"use client";

import type { FileUploadProps } from "@/lib/shared/types/file-upload.types";

import { useCallback, useRef, useState } from "react";
import { Alert, CloseButton } from "@heroui/react";

import {
  formatFileSize,
  validateFile,
} from "@/lib/shared/utils/file-upload.utils";

import {
  DEFAULT_MARKETING_FOOTNOTE,
  FileUploadDropzoneMarketing,
} from "./file-upload-dropzone-marketing";
import { FileUploadDropzone } from "./file-upload-dropzone";
import { FileUploadPreview } from "./file-upload-preview";

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100 MB
const ERROR_DISMISS_MS = 4000;

export function FileUpload({
  accept,
  acceptLabel,
  appearance = "default",
  browseLabel,
  description,
  file = null,
  heading,
  marketingFootnote,
  marketingGrouped = false,
  maxSize = DEFAULT_MAX_SIZE,
  onFileClear,
  onFileSelect,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const showError = useCallback((message: string) => {
    setError(message);

    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), ERROR_DISMISS_MS);
  }, []);

  const handleFile = useCallback(
    (candidate: File) => {
      const result = validateFile(candidate, accept, maxSize);

      if (!result.valid) {
        showError(result.error);

        return;
      }

      onFileSelect(candidate);
    },
    [accept, maxSize, onFileSelect, showError],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;

    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;

    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];

      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];

      if (selected) handleFile(selected);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const handleClear = useCallback(() => {
    onFileClear?.();
  }, [onFileClear]);

  const maxSizeLabel = `Up to ${formatFileSize(maxSize)}`;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <input
        ref={inputRef}
        accept={accept.join(",")}
        aria-label={heading ?? "Upload a file"}
        className="hidden"
        type="file"
        onChange={handleInputChange}
      />

      {file ? (
        <FileUploadPreview file={file} onClear={handleClear} />
      ) : appearance === "marketing" ? (
        <div
          className="flex w-full justify-center"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <FileUploadDropzoneMarketing
            browseLabel={browseLabel}
            embedded={marketingGrouped}
            footnote={marketingFootnote ?? DEFAULT_MARKETING_FOOTNOTE}
            heading={heading}
            isDragging={isDragging}
            onBrowsePress={handleClick}
          />
        </div>
      ) : (
        <div
          aria-label="File upload dropzone"
          className="flex w-full cursor-pointer justify-center"
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
        >
          <FileUploadDropzone
            acceptLabel={acceptLabel}
            description={description}
            heading={heading}
            isDragging={isDragging}
            maxSizeLabel={maxSizeLabel}
          />
        </div>
      )}

      {error ? (
        <Alert className="max-w-4xl rounded-2xl" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{error}</Alert.Title>
          </Alert.Content>
          <CloseButton onPress={() => setError(null)} />
        </Alert>
      ) : null}
    </div>
  );
}
