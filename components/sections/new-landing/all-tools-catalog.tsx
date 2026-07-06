import Link from "next/link";

import { LANDING_TOOL_CATEGORIES } from "@/lib/shared/constants/landing-tools";

import { AllToolsIcon } from "./all-tools-icon";

/**
 * The 4-column tool catalog from `Frame 2147239344.png`. Column widths and
 * gaps are set to match the Figma auto-layout (172px column, 94px column
 * gap, 43px between heading and rows, 27px between rows). Below `lg` the
 * grid collapses to 2 columns and then 1 to keep tap targets sensible.
 *
 * Rows are `<Link>`s so the whole 21px band is clickable, and the label
 * gets a subtle red hue + 2px x-shift on hover. Icons use `currentColor`
 * so they follow the same tone.
 */
export function AllToolsCatalog() {
  return (
    <section
      aria-labelledby="all-tools-heading"
      className="bg-white py-16 sm:py-20"
    >
      <div className="pv-container">
        <h1 className="sr-only" id="all-tools-heading">
          Every PDFVault tool
        </h1>

        <div className="grid grid-cols-1 gap-y-12 sm:grid-cols-2 md:gap-x-16 lg:grid-cols-4 lg:gap-x-[94px]">
          {LANDING_TOOL_CATEGORIES.map((column, columnIndex) => (
            <div
              key={column.id}
              className="pv-fade-up flex flex-col"
              style={{ animationDelay: `${columnIndex * 90}ms` }}
            >
              <h2 className="text-[14px] font-normal uppercase leading-[16px] tracking-[-0.02em] text-black/60">
                {column.heading}
              </h2>

              <ul className="mt-[43px] flex flex-col gap-[27px]">
                {column.tools.map((tool) => (
                  <li key={tool.label}>
                    <Link
                      className="group flex items-center gap-[10px] text-[16px] leading-[21px] tracking-[-0.03em] text-[#121212] transition-colors duration-200 hover:text-[var(--pv-brand-primary)]"
                      href={tool.href}
                    >
                      <span className="inline-flex size-[18px] shrink-0 items-center justify-center text-[#121212] transition-colors duration-200 group-hover:text-[var(--pv-brand-primary)]">
                        <AllToolsIcon icon={tool.icon} />
                      </span>
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                        {tool.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
