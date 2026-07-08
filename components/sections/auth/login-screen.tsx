import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/lib/shared/constants/routes";

import {
  AUTH_GRID_CELL_PX,
  AuthBackground,
  type AuthBackgroundTile,
} from "./auth-background";
import { LoginCard } from "./login-card";
import { LoginLanguageMenu } from "./login-language-menu";

// The login reference's grid starts right below the 56px menu bar.
const GRID_TOP_PX = 56;

// Sparse pale-gray filled tiles, traced from the reference distribution
// (asymmetric, not a checkerboard) — on the cell lattice below the header.
const LOGIN_TILES: AuthBackgroundTile[] = [
  { col: 4, row: 1 },
  { col: 11, row: 1 },
  { col: 2, row: 2 },
  { col: 3, row: 4 },
  { col: 10, row: 3 },
  { col: 9, row: 5 },
  { col: 3, row: 6 },
  { col: 6, row: 7 },
  { col: 13, row: 6 },
].map(({ col, row }) => ({
  left: (col - 1) * AUTH_GRID_CELL_PX,
  top: (row - 1) * AUTH_GRID_CELL_PX,
}));

export function LoginScreen() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#fdfdfd]">
      <AuthBackground
        backgroundPosition="0 -1px"
        tiles={LOGIN_TILES}
        top={GRID_TOP_PX}
      />

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
              className="h-[26px] w-auto object-contain"
              height={26}
              src="/landing/logo-with-text.png"
              width={104}
            />
          </Link>
          <LoginLanguageMenu />
        </div>
      </header>

      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-24">
        <LoginCard />
      </main>
    </div>
  );
}
