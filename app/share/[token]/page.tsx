import type { Metadata } from "next";

import { cookies } from "next/headers";

import { resolveShare } from "@/lib/server/share/resolve-share";
import {
  mintViewCookie,
  VIEW_COOKIE_NAME,
  viewCookieOptions,
} from "@/lib/server/share/view-cookie";

import { PasswordGate } from "./PasswordGate";
import { ViewerClient } from "./ViewerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

type ResolveErrReason =
  | "not-found"
  | "expired"
  | "revoked"
  | "malformed"
  | "bad-signature";

function reasonToMessage(reason: ResolveErrReason): string {
  switch (reason) {
    case "not-found":
      return "This share link doesn't exist or its content is no longer available.";
    case "expired":
      return "This share link has expired.";
    case "revoked":
      return "This share link has been revoked by the owner.";
    case "malformed":
    case "bad-signature":
      return "This share link isn't valid.";
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  // Resolve directly in-process. Previously this component fetched
  // `/api/share/resolve` over HTTP, which required the server to know
  // its own public origin — a footgun in multi-env setups (a share
  // created on `staging.pdfvault.ai` returned a `www.pdfvault.ai` URL
  // via NEXT_PUBLIC_APP_URL, and the fetch then failed on the wrong
  // instance, rendering a 500 black screen for the recipient).
  const result = await resolveShare(token);

  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Link unavailable</h1>
        <p className="text-default-600">{reasonToMessage(result.reason)}</p>
      </main>
    );
  }

  // Mirror the route handler's cookie mint so the viewer can pull bytes
  // without an extra round-trip on password-less shares.
  if (!result.requiresPassword) {
    const cookie = await mintViewCookie(result.jti);
    const cookieStore = await cookies();

    cookieStore.set(VIEW_COOKIE_NAME, cookie, viewCookieOptions(token));
  }

  if (result.requiresPassword) {
    return (
      <PasswordGate
        bytesUrl={`/api/share/bytes/${encodeURIComponent(token)}`}
        name={result.name}
        token={token}
      />
    );
  }

  return (
    <ViewerClient
      bytesUrl={`/api/share/bytes/${encodeURIComponent(token)}`}
      name={result.name}
      token={token}
    />
  );
}
