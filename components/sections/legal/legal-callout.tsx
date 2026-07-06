import type { ReactNode } from "react";

type LegalCalloutProps = {
  children: ReactNode;
  title?: string;
  variant: "emphasis" | "success";
};

/**
 * Lightweight inline callout used inside policy sections. The new UI drops the
 * pink/green boxed variants — the callout is now a subtle bordered inset that
 * blends with the surrounding prose (matches Figma frames 2147239362/3).
 * The `variant` prop is preserved for backwards compatibility.
 */
export function LegalCallout({ children, title }: LegalCalloutProps) {
  return (
    <div className="rounded-md border-l-2 border-[var(--pv-border-subtle)] bg-[var(--pv-gray-1)] px-4 py-3">
      {title ? <p className="font-semibold text-[#121212]">{title}</p> : null}
      <div className={title ? "mt-1 space-y-2" : "space-y-2"}>{children}</div>
    </div>
  );
}
