export function UploadDropzone() {
  return (
    <div className="w-full max-w-4xl rounded-[2rem] border border-dashed border-[color-mix(in_oklab,var(--color-accent)_40%,var(--color-background))] p-4 sm:p-5">
      <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-[1.75rem] bg-[var(--color-accent)] px-6 py-10 text-center text-[var(--color-background)] sm:min-h-[22rem]">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-foreground)_16%,var(--color-background))] bg-[var(--color-background)] text-5xl font-light text-[var(--color-foreground)] shadow-sm">
          +
        </div>
        <p className="mt-8 text-2xl font-semibold tracking-tight">
          Drop your PDF files here
        </p>
        <p className="mt-3 max-w-lg text-sm text-[color-mix(in_oklab,var(--color-background)_72%,transparent)] sm:text-base">
          Merge, convert, and prepare documents from one calm workspace.
        </p>
        <span className="mt-10 text-sm text-[color-mix(in_oklab,var(--color-background)_72%,transparent)]">
          Size up to 100 MB
        </span>
      </div>
    </div>
  );
}
