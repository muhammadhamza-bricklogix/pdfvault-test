import type { ReactNode } from "react";

type LegalCalloutProps = {
  children: ReactNode;
  title?: string;
  variant: "emphasis" | "success";
};

export function LegalCallout({ children, title, variant }: LegalCalloutProps) {
  const isSuccess = variant === "success";

  return (
    <div
      className={
        isSuccess
          ? "rounded-xl border-l-4 px-4 py-3"
          : "rounded-xl border-l-4 px-4 py-3"
      }
      style={
        isSuccess
          ? {
              backgroundColor: "var(--legal-callout-green-bg)",
              borderColor: "var(--legal-callout-green-border)",
              color: "var(--legal-callout-green-text)",
            }
          : {
              backgroundColor: "var(--legal-pink-callout)",
              borderColor: "var(--legal-burgundy)",
              color: "var(--legal-text-body)",
            }
      }
    >
      {title ? (
        <p
          className={`font-semibold ${isSuccess ? "" : "text-[var(--legal-burgundy)]"}`}
        >
          {title}
        </p>
      ) : null}
      <div
        className={
          title
            ? "mt-1 space-y-2 text-sm leading-relaxed"
            : "space-y-2 text-sm leading-relaxed"
        }
      >
        {children}
      </div>
    </div>
  );
}
