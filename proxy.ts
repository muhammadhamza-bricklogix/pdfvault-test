import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

const DASHBOARD_PATH = "/dashboard";
const SIGN_IN_PATH = "/sign-in";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/tools/(.*)"]);

/**
 * Classifies the `?id=` parameter on the `/pdf-composer` route:
 *   - "absent"  → bare `/pdf-composer` (no `id` param at all). Intentionally
 *     PUBLIC — the editor runs in local upload-and-edit mode without an
 *     account, and the marketing site / navbar / footer link here.
 *   - "empty"   → `/pdf-composer?id=` (param present but blank / whitespace).
 *     Never a valid editor URL (a broken or half-built link) — we bounce the
 *     user out instead of showing a blank editor.
 *   - "present" → `/pdf-composer?id=<docId>`. Needs a signed-in user because
 *     the document fetch is auth-gated. Without this gate, signed-out
 *     visitors hitting an editor URL with an id saw a blank editor + a
 *     "Couldn't open document" toast — QA-reported 2026-06-16.
 */
function editorDocIdState(req: NextRequest): "absent" | "empty" | "present" {
  if (req.nextUrl.pathname !== "/pdf-composer") return "absent";
  if (!req.nextUrl.searchParams.has("id")) return "absent";

  return (req.nextUrl.searchParams.get("id") ?? "").trim() === ""
    ? "empty"
    : "present";
}

function redirectToSignIn(req: NextRequest, returnTo: string): NextResponse {
  const signInUrl = new URL(SIGN_IN_PATH, req.url);

  signInUrl.searchParams.set("redirect_url", returnTo);

  return NextResponse.redirect(signInUrl);
}

export default clerkMiddleware(async (auth, req) => {
  const idState = editorDocIdState(req);

  // `/pdf-composer?id=` with an empty id is never a valid editor URL. Send the
  // user somewhere useful instead of a blank editor: signed-in → dashboard,
  // signed-out → sign-in. Runs server-side, so it behaves identically on web
  // and mobile with no editor flash.
  if (idState === "empty") {
    const { userId } = await auth();

    if (!userId) {
      return redirectToSignIn(req, DASHBOARD_PATH);
    }

    return NextResponse.redirect(new URL(DASHBOARD_PATH, req.url));
  }

  // Auth-gate the protected app routes + `/pdf-composer?id=<docId>`. Signed-out
  // users are bounced to sign-in with a return path so they land back on the
  // same URL after authenticating.
  if (isProtectedRoute(req) || idState === "present") {
    const { userId } = await auth();

    if (!userId) {
      return redirectToSignIn(req, req.nextUrl.pathname + req.nextUrl.search);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
