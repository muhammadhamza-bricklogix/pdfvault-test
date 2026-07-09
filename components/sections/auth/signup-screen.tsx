import Image from "next/image";
import Link from "next/link";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { ROUTES } from "@/lib/shared/constants/routes";

import { LoginLanguageMenu } from "./login-language-menu";
import { SignupCard } from "./signup-card";

// Background pattern removed per user request — screen renders on plain
// #fdfdfd. If you ever want the grid + tiles back, restore the imports
// from `./auth-background` and re-add `<AuthBackground …/>` below.

export function SignupScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="z-20 shrink-0">
        <div className="flex items-center justify-between px-6 pt-[9px] sm:px-10">
          <Link
            aria-label="PDFVault home"
            className="-ml-[3px] inline-flex"
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
          <LoginLanguageMenu />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6">
        <SignupCard />
      </main>

      <div className="relative z-10 shrink-0">
        <LandingFooter />
      </div>
    </div>
  );
}
