import type { ReactNode } from "react";

type LegalSegmentLayoutProps = {
  children: ReactNode;
};

export default function LegalSegmentLayout({
  children,
}: LegalSegmentLayoutProps) {
  return (
    <div
      className="legal-doc-root min-h-full w-full flex-1 bg-[var(--legal-surface)] text-neutral-900 antialiased dark:bg-[var(--legal-surface)] dark:text-neutral-900"
      data-legal="1"
    >
      {children}
    </div>
  );
}
