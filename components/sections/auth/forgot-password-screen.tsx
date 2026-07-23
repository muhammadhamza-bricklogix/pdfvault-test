import Image from "next/image";
import Link from "next/link";

import { LandingLanguageSwitcher } from "@/components/sections/new-landing/landing-language-switcher";
import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { ROUTES } from "@/lib/shared/constants/routes";

import { ForgotPasswordCard } from "./forgot-password-card";

/**
 * Full-page wrapper for `/forgot-password`. Same chrome as the sign-in
 * and sign-up screens — brand logo, language switcher in the top-right,
 * centered auth card, landing footer — so the auth surfaces feel like
 * one coherent flow.
 */
export function ForgotPasswordScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="z-20 shrink-0">
        <div className="flex items-center justify-between px-6 pt-4 sm:px-10">
          <Link
            aria-label="PDFVault home"
            className="inline-flex"
            href={ROUTES.PUBLIC.HOME}
          >
            <Image
              priority
              alt="PDFVault"
              className="h-[40px] w-auto object-contain sm:h-[46px]"
              height={46}
              src="/landing/logo-with-text.png"
              width={184}
            />
          </Link>
          <LandingLanguageSwitcher />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <ForgotPasswordCard />
      </main>

      <div className="relative z-10 shrink-0">
        <LandingFooter />
      </div>
    </div>
  );
}
