import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInSection } from "@/components/sections/auth/sign-in-section";
import { ROUTES } from "@/lib/shared/constants/routes";

export default async function SignInPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(ROUTES.APP.DASHBOARD);
  }

  return (
    <Suspense fallback={null}>
      <SignInSection />
    </Suspense>
  );
}
