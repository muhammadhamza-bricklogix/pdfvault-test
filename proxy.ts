import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/tools/(.*)"]);

/**
 * `/pdf-editor` is a public route (the editor runs locally without
 * an account), BUT `/pdf-editor?id=<docId>` needs a signed-in user
 * because the document fetch is auth-gated. Without this gate,
 * signed-out visitors hitting an editor URL with an id saw a blank
 * editor + a "Couldn't open document" toast — QA-reported 2026-06-16.
 */
function isEditorWithDocId(req: NextRequest): boolean {
  return (
    req.nextUrl.pathname === "/pdf-editor" &&
    !!req.nextUrl.searchParams.get("id")
  );
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req) || isEditorWithDocId(req)) {
    const { userId } = await auth();

    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);

      signInUrl.searchParams.set(
        "redirect_url",
        req.nextUrl.pathname + req.nextUrl.search,
      );

      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
