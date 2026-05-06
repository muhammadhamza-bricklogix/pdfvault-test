import type { ReactNode } from "react";

type LegalSubsectionProps = {
  children: ReactNode;
  id?: string;
  title: string;
};

export function LegalSubsection({
  children,
  id,
  title,
}: LegalSubsectionProps) {
  return (
    <section className="scroll-mt-24" id={id}>
      <h2 className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-default-600 dark:text-default-400">
        {children}
      </div>
    </section>
  );
}
