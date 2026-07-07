import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginScreen } from "@/components/sections/auth/login-screen";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  title: "Login to PDFVault",
};

export default async function LoginPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(ROUTES.APP.DASHBOARD);
  }

  return (
    // Suspense is required because LoginCard reads ?redirect_url via
    // useSearchParams (same pattern as the existing /sign-in page).
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
