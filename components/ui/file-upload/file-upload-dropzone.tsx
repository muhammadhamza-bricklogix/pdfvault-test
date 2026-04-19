type FileUploadDropzoneProps = {
  acceptLabel: string;
  description?: string;
  heading?: string;
  isDragging: boolean;
  maxSizeLabel: string;
};

export function FileUploadDropzone({
  acceptLabel,
  description,
  heading = "Drop your files here",
  isDragging,
  maxSizeLabel,
}: FileUploadDropzoneProps) {
  return (
    <div
      className={`w-full max-w-4xl rounded-[2rem] border p-4 transition-all duration-200 sm:p-5 ${
        isDragging
          ? "border-solid border-[var(--color-accent)] shadow-[0_0_0_2px_var(--app-accent-subtle)]"
          : "border-dashed border-[color-mix(in_oklab,var(--color-accent)_40%,var(--color-background))]"
      }`}
    >
      <div
        className={`flex min-h-[20rem] flex-col items-center justify-center rounded-[1.75rem] bg-[var(--color-accent)] px-6 py-10 text-center text-[var(--color-background)] transition-transform duration-200 sm:min-h-[22rem] ${
          isDragging ? "scale-[1.01]" : ""
        }`}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-foreground)_16%,var(--color-background))] bg-[var(--color-background)] text-5xl font-light text-[var(--color-foreground)] shadow-sm">
          {isDragging ? "\u2193" : "+"}
        </div>

        <p className="mt-8 text-2xl font-semibold tracking-tight">
          {isDragging ? "Drop it here" : heading}
        </p>

        {!isDragging && description ? (
          <p className="mt-3 max-w-lg text-sm text-[color-mix(in_oklab,var(--color-background)_72%,transparent)] sm:text-base">
            {description}
          </p>
        ) : null}

        <span className="mt-10 text-sm text-[color-mix(in_oklab,var(--color-background)_72%,transparent)]">
          {acceptLabel} &middot; {maxSizeLabel}
        </span>
      </div>
    </div>
  );
}
