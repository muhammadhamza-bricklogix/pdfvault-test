import type { ReactNode } from "react";

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return <div>{children}</div>;
}
