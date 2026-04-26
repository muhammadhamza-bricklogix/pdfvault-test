import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SignUpSection } from "@/components/sections/auth/sign-up-section";
import { ROUTES } from "@/lib/shared/constants/routes";

export default async function SignUpPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(ROUTES.APP.DASHBOARD);
  }

  return <SignUpSection />;
}
