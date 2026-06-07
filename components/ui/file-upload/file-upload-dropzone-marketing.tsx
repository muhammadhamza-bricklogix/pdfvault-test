import { Add01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";

export const DEFAULT_MARKETING_FOOTNOTE =
  "Up to 100 MB for PDF and up to 20 MB for Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx), Image (.gif, .jpg, .jpeg, .png), HTML, or Plain Text (.txt)";

type FileUploadDropzoneMarketingProps = {
  browseLabel?: string;
  embedded?: boolean;
  footnote: string;
  heading?: string;
  isDragging: boolean;
  onBrowsePress: () => void;
};

export function FileUploadDropzoneMarketing({
  browseLabel = "Browse files",
  embedded = false,
  footnote,
  heading = "Drop your file here",
  isDragging,
  onBrowsePress,
}: FileUploadDropzoneMarketingProps) {
  const outerFrame = embedded
    ? "w-full rounded-none border-0 bg-transparent p-0 shadow-none ring-0 backdrop-blur-none"
    : `w-full max-w-5xl rounded-[2rem] border bg-[var(--color-background)]/75 p-5 backdrop-blur-sm transition-all duration-200 sm:p-6 ${
        isDragging
          ? "border-solid border-accent ring-2 ring-accent/15"
          : "border-dashed border-default-300 dark:border-default-600"
      }`;

  return (
    <div className={outerFrame}>
      <div
        className={`flex min-h-[20rem] flex-col items-center justify-center rounded-[1.75rem] bg-white/70 px-8 py-12 text-center transition-colors duration-200 dark:bg-default-50/10 sm:min-h-[23rem] ${
          embedded && isDragging ? "ring-2 ring-accent/20" : ""
        } ${!embedded && isDragging ? "scale-[1.005]" : ""}`}
      >
        <div
          aria-hidden
          className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-default-200 bg-[var(--color-background)] text-default-600 shadow-sm dark:border-default-700"
        >
          <HugeiconsIcon icon={File01Icon} size={44} />
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-background)] shadow-md">
            <HugeiconsIcon icon={Add01Icon} size={18} />
          </span>
        </div>

        <p className="mt-10 text-2xl font-semibold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          {isDragging ? "Drop it here" : heading}
        </p>

        <Button
          className="mt-7 rounded-full px-12 text-base font-semibold sm:text-lg"
          size="lg"
          onPress={onBrowsePress}
        >
          {browseLabel}
        </Button>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-default-500 sm:text-base">
          {footnote}
        </p>
      </div>
    </div>
  );
}
