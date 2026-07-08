import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignupScreen } from "@/components/sections/auth/signup-screen";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  title: "Sign Up for PDFVault",
};

export default async function SignupPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(ROUTES.APP.DASHBOARD);
  }

  return (
    // Suspense is required because SignupCard reads ?redirect_url via
    // useSearchParams (same pattern as the /login page).
    <Suspense fallback={null}>
      <SignupScreen />
    </Suspense>
  );
}
