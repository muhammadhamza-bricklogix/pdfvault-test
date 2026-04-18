import Link from "next/link";

type AuthShellProps = {
  alternateHref: string;
  alternateLabel: string;
  alternateText: string;
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  title: string;
};

export function AuthShell({
  alternateHref,
  alternateLabel,
  alternateText,
  children,
  description,
  eyebrow,
  title,
}: AuthShellProps) {
  return (
    <section className="grid w-full gap-10 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="space-y-6">
        <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
          {eyebrow}
        </span>
        <div className="space-y-4">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[var(--app-muted)]">
            {description}
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border bg-[var(--app-surface)] p-6 sm:p-8">
        {children}
        <p className="mt-6 text-sm text-[var(--app-muted)]">
          {alternateText}{" "}
          <Link
            className="font-semibold text-[var(--color-accent)]"
            href={alternateHref}
          >
            {alternateLabel}
          </Link>
        </p>
      </div>
    </section>
  );
}
