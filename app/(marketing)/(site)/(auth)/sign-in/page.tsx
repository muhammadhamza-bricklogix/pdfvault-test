import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginScreen } from "@/components/sections/auth/login-screen";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  title: "Sign in to PDFVault",
};

export default async function SignInPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(ROUTES.APP.DASHBOARD);
  }

  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
