import Image from "next/image";
import Link from "next/link";

import { LandingFooter } from "@/components/sections/new-landing/landing-footer";
import { ROUTES } from "@/lib/shared/constants/routes";

import { LoginCard } from "./login-card";
import { LoginLanguageMenu } from "./login-language-menu";

// Background pattern removed per user request — screen renders on plain
// #fdfdfd. If you ever want the grid + tiles back, restore the imports
// from `./auth-background` and re-add `<AuthBackground …/>` below.

export function LoginScreen() {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-[1226px] items-center justify-between px-6 pt-4 sm:px-10">
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
          <LoginLanguageMenu />
        </div>
      </header>

      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-24">
        <LoginCard />
      </main>

      <div className="relative z-10">
        <LandingFooter />
      </div>
    </>
  );
}
