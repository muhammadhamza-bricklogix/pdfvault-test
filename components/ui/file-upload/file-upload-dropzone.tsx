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
      className={`group w-full max-w-4xl rounded-[2rem] border p-4 transition-all duration-300 sm:p-5 ${
        isDragging
          ? "border-solid border-accent shadow-2xl ring-4 ring-accent/20"
          : "border-dashed border-[color-mix(in_oklab,var(--color-accent)_45%,var(--color-background))] hover:border-solid hover:border-accent hover:shadow-xl"
      }`}
    >
      <div
        className={`flex min-h-[20rem] flex-col items-center justify-center rounded-[1.75rem] bg-[var(--color-accent)] px-6 py-10 text-center text-[var(--color-background)] transition-transform duration-300 sm:min-h-[22rem] ${
          isDragging ? "scale-[1.015]" : "group-hover:scale-[1.008]"
        }`}
      >
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-foreground)_16%,var(--color-background))] bg-[var(--color-background)] text-5xl font-light text-[var(--color-foreground)] shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          {!isDragging ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[var(--color-background)]/40 animate-pulse"
            />
          ) : null}
          <span className={isDragging ? "inline-block animate-bounce" : ""}>
            {isDragging ? "\u2193" : "+"}
          </span>
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
