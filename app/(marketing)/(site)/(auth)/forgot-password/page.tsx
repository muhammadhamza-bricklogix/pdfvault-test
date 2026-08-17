import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ForgotPasswordScreen } from "@/components/sections/auth/forgot-password-screen";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  title: "Forgot your password — PDFVault",
};

export default async function ForgotPasswordPage() {
  const { userId } = await auth();

  // Signed-in users don't need the reset flow — send them to the
  // dashboard. They can change their password from Settings.
  if (userId) {
    redirect(ROUTES.APP.DASHBOARD);
  }

  return (
    <Suspense fallback={null}>
      <ForgotPasswordScreen />
    </Suspense>
  );
}
