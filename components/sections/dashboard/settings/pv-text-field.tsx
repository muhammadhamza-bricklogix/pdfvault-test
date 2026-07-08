"use client";

import type { ComponentProps } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { forwardRef } from "react";

type IconGlyph = ComponentProps<typeof HugeiconsIcon>["icon"];

interface PvTextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "children"> {
  leadingIcon?: IconGlyph;
  hint?: string;
  invalid?: boolean;
}

/**
 * Rounded pill input matching the settings frames. Optional leading icon on
 * the left, optional hint under the field. Reads styling from the
 * `.pv-dashboard` token scope so hover/focus stay on-brand.
 */
export const PvTextField = forwardRef<HTMLInputElement, PvTextFieldProps>(
  function PvTextField(
    { leadingIcon, hint, invalid, className, disabled, ...rest },
    ref,
  ) {
    return (
      <div className="min-w-0">
        <div
          className={`relative flex h-11 items-center rounded-full border bg-[var(--pv-surface)] transition-colors focus-within:border-[#7F56D9] focus-within:ring-2 focus-within:ring-[#7F56D9]/20 ${
            invalid ? "border-red-400" : "border-[var(--pv-hairline-strong)]"
          } ${disabled ? "!bg-[var(--pv-fill-subtle)] opacity-80" : ""}`}
        >
          {leadingIcon ? (
            <span className="pointer-events-none pl-4 text-[var(--pv-text-muted)]">
              <HugeiconsIcon icon={leadingIcon} size={16} />
            </span>
          ) : null}
          <input
            ref={ref}
            className={`h-full flex-1 bg-transparent px-4 text-[14px] text-[var(--pv-text-strong)] outline-none placeholder:text-[var(--pv-text-muted)] ${
              leadingIcon ? "pl-2" : ""
            } ${className ?? ""}`}
            disabled={disabled}
            {...rest}
          />
        </div>
        {hint ? (
          <p className="mt-2 text-[12px] text-[var(--pv-text-muted)]">{hint}</p>
        ) : null}
      </div>
    );
  },
);
