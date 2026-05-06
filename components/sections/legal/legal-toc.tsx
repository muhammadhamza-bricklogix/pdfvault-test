"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type LegalTocEntry = {
  id: string;
  label: string;
};

type LegalTocProps = {
  entries: LegalTocEntry[];
};

export function LegalToc({ entries }: LegalTocProps) {
  const ids = entries.map((e) => e.id);
  const [activeId, setActiveId] = useState(ids[0] ?? "");

  useEffect(() => {
    const offset = 112;

    const updateActive = () => {
      let current = ids[0] ?? "";

      for (const id of ids) {
        const el = document.getElementById(id);

        if (!el) {
          continue;
        }

        const { top } = el.getBoundingClientRect();

        if (top <= offset) {
          current = id;
        }
      }

      setActiveId(current);
    };

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [ids]);

  return (
    <>
      <nav aria-label="On this page" className="flex gap-2 overflow-x-auto pb-3 lg:hidden">
        <div className="flex min-w-max gap-2">
          {entries.map((item) => (
            <Link
              key={item.id}
              aria-current={activeId === item.id ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeId === item.id
                  ? "bg-[var(--legal-pink-active)] text-[var(--legal-burgundy)]"
                  : "bg-white/80 text-[var(--legal-text-muted)] ring-1 ring-[var(--legal-border-subtle)]"
              }`}
              href={`#${item.id}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <nav aria-label="On this page" className="sticky top-24 hidden lg:block">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--legal-text-muted)]">
          On this page
        </p>
        <ul className="relative mt-4 flex flex-col gap-0.5 border-l-2 border-[var(--legal-border-subtle)] pl-0">
          {entries.map((item) => {
            const isActive = activeId === item.id;

            return (
              <li key={item.id} className="relative">
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute -left-0.5 top-1 bottom-1 w-0.5 rounded-full bg-[var(--legal-burgundy)]"
                  />
                ) : null}
                <Link
                  aria-current={isActive ? "location" : undefined}
                  className={`block rounded-md py-2 pr-2 pl-4 text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--legal-pink-active)] font-medium text-[var(--legal-burgundy)]"
                      : "text-[var(--legal-text-body)] hover:bg-black/[0.03]"
                  }`}
                  href={`#${item.id}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
