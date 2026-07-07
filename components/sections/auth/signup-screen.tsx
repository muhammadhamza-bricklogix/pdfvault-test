import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

import { AuthBackground, type AuthBackgroundTile } from "./auth-background";
import { LoginLanguageMenu } from "./login-language-menu";
import { SignupCard } from "./signup-card";

// The signup reference's grid starts 46px below the viewport top (right under
// the menu bar) with the line phase shifted -1px on x.
const GRID_TOP_PX = 46;

// Pale filled tiles traced from Signup@2x.png (positions are viewport px
// minus the 46px offset). The designer nudged a few off the line lattice by
// half a cell — these are measured rectangles, not lattice math. Two tiles
// sit partially behind the card (left of it at y≈141, right of it at y≈660).
const SIGNUP_TILES: AuthBackgroundTile[] = [
  { left: 1227.5, top: 48.5 },
  { left: 471.5, top: 95.5 },
  { left: 188, top: 189 },
  { left: 1321.5, top: 236.5 },
  { left: 1132.5, top: 330.5 },
  { left: 283, top: 378 },
  { left: 1038.5, top: 614.5 },
  { left: 283, top: 661 },
];

export function SignupScreen() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#fdfdfd]">
      <AuthBackground
        backgroundPosition="-1px -1px"
        tiles={SIGNUP_TILES}
        top={GRID_TOP_PX}
      />

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
                className="h-[34px] w-auto object-contain"
                height={34}
                src="/landing/logo-with-text.png"
                width={98}
              />
            </Link>
            <LoginLanguageMenu />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-6">
        <SignupCard />
      </main>
    </div>
  );
}
