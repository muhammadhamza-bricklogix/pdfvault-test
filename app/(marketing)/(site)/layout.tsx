import type { ReactNode } from "react";

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="mx-auto flex w-full max-w-[min(100%,104rem)] flex-1 flex-col px-6 py-10 sm:px-8 sm:py-12">
      {children}
    </div>
  );
}
