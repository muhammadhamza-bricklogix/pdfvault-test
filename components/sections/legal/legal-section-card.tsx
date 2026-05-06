import type { ComponentProps, ReactNode } from "react";

import { HugeiconsIcon } from "@hugeicons/react";

type IconProp = ComponentProps<typeof HugeiconsIcon>["icon"];

type LegalSectionCardProps = {
  children: ReactNode;
  icon: IconProp;
  id: string;
  title: string;
};

export function LegalSectionCard({
  children,
  icon,
  id,
  title,
}: LegalSectionCardProps) {
  return (
    <section
      className="scroll-mt-28 overflow-hidden rounded-2xl border border-[var(--legal-border-subtle)] bg-white shadow-sm"
      id={id}
    >
      <div className="flex items-start gap-3 bg-[var(--legal-pink-header)] px-5 py-4 sm:items-center sm:gap-4">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--legal-burgundy)] text-white sm:mt-0">
          <HugeiconsIcon icon={icon} size={22} />
        </span>
        <h2 className="font-legal-serif text-lg font-semibold leading-snug text-[var(--legal-burgundy)] sm:text-xl">
          {title}
        </h2>
      </div>
      <div className="border-t border-[var(--legal-border-subtle)] px-5 py-5 text-sm leading-relaxed text-[var(--legal-text-body)] [&_a]:font-medium [&_a]:text-[var(--legal-burgundy)] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-[var(--legal-burgundy)] [&_li]:marker:text-[var(--legal-burgundy)]">
        {children}
      </div>
    </section>
  );
}
