import type { Metadata } from "next";

import { LoginScreen } from "@/components/sections/auth/login-screen";

export const metadata: Metadata = {
  title: "Login to PDFVault",
};

export default function LoginPage() {
  return <LoginScreen />;
}
