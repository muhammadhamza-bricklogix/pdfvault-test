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
    <>
      <header className="absolute inset-x-0 top-0 z-20">
        {/* Padding sits OUTSIDE the max-width box so the content lands at
            x=143 on the 1512 artboard (143..1369 = 1226 wide, centered).
            The logo asset carries ~20% transparent padding, so the 34px box
            (+9px top inset, -3px left nudge) puts the visible artwork at the
            reference's ~92x20.5 @ (144, 15.5). */}
        <div className="px-6 pt-[9px] sm:px-10">
          <div className="mx-auto flex max-w-[1226px] items-center justify-between">
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
        </div>
      </header>

      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-6">
        <SignupCard />
      </main>

      <div className="relative z-10">
        <LandingFooter />
      </div>
    </>
  );
}
