import type { Metadata } from "next";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { GtagConversion } from "@/components/shared/gtag-conversion";
import { SignupScreen } from "@/components/sections/auth/signup-screen";
import { ROUTES } from "@/lib/shared/constants/routes";

export const metadata: Metadata = {
  title: "Sign up for PDFVault",
};

export default async function SignUpPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(ROUTES.APP.DASHBOARD);
  }

  return (
    <>
      <GtagConversion sendTo="AW-18226423046/_l8jCOv0yuccEIbKhPND" />
      <Suspense fallback={null}>
        <SignupScreen />
      </Suspense>
    </>
  );
}
