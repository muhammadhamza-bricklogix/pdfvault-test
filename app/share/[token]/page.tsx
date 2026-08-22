import type { Metadata } from "next";

import { resolveShare } from "@/lib/server/share/resolve-share";

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

  // NOTE: don't try to mint the `share_view` cookie here. Set-Cookie
  // headers written from a Server Component don't propagate reliably in
  // Next.js production builds — the previous `cookies().set()` call
  // either silently no-op'd or threw a 500 depending on runtime. The
  // `ViewerClient` (below) pre-flights `/api/share/resolve` from the
  // browser, which mints the cookie via a real Set-Cookie response
  // header that the user agent actually stores. `PasswordGate` handles
  // the equivalent for password-protected shares via
  // `/api/share/verify-password`.
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
