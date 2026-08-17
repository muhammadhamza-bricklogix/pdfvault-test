import { Suspense } from "react";

import { DashboardHome } from "@/components/sections/dashboard/dashboard-home";

export default function DashboardPage() {
  // Suspense boundary required because DashboardHome now calls
  // `useSearchParams()` to read `?openPicker=<slug>`, and Next 16's
  // static generation of `/dashboard` bails on the pre-render without
  // one — the `useSearchParams() should be wrapped in a suspense
  // boundary` build error.
  return (
    <Suspense fallback={null}>
      <DashboardHome />
    </Suspense>
  );
}
