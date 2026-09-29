import type { ComponentProps, ReactNode } from "react";

import { HugeiconsIcon } from "@hugeicons/react";

type IconProp = ComponentProps<typeof HugeiconsIcon>["icon"];

type LegalSectionCardProps = {
  children: ReactNode;
  icon?: IconProp;
  id: string;
  /**
   * Section heading. Accepts a plain string for the common case OR a
   * `ReactNode` so callers can fence product names / cookie IDs from
   * Weglot with inline `<span className="notranslate">…</span>` (see
   * refund-policy-content "Credits and Add-on Features", QA F-45).
   */
  title: ReactNode;
};

/**
 * Plain-prose section wrapper used by every policy page. Matches Figma frames
 * 2147239362 / 2147239363: a simple h2 followed by paragraphs / lists, with
 * no card chrome, no icon boxes, no pink header. The `icon` prop is accepted
 * for backwards compatibility with existing content components but ignored.
 */
export function LegalSectionCard({
  children,
  id,
  title,
}: LegalSectionCardProps) {
  return (
    <section className="scroll-mt-28" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
