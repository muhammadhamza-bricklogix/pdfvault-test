"use client";

import type { ReactNode } from "react";

import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

/**
 * Section title + muted subtitle. Sits above every settings section
 * (Personal info, Password, etc.). Matches the frames' 15/13 rhythm.
 */
export function PvSectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="pt-6 first:pt-0">
      <h3 className="pv-heading text-[15px] font-semibold text-[var(--pv-text-strong)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-[13px] text-[var(--pv-text-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Two-column form row from the frames. Label + optional description in the
 * left column (~200px), control in the right column. A hairline divider
 * sits below each row (skipped on `last`).
 */
export function PvFormRow({
  label,
  description,
  required,
  helpTip,
  children,
  last,
}: {
  label: string;
  description?: string;
  required?: boolean;
  helpTip?: boolean;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid gap-6 py-6 sm:grid-cols-[minmax(0,200px)_1fr] ${
        last ? "" : "border-b border-[var(--pv-hairline)]"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <label className="text-[13px] font-medium text-[var(--pv-text-strong)]">
            {label}
            {required ? <span className="ml-0.5 text-[#7F56D9]">*</span> : null}
          </label>
          {helpTip ? (
            <HugeiconsIcon
              className="text-[var(--pv-text-muted)]"
              icon={HelpCircleIcon}
              size={12}
            />
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-[12px] text-[var(--pv-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
