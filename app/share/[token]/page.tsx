import type { Metadata } from "next";

import { headers } from "next/headers";
import { notFound } from "next/navigation";

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

type ResolveOk = {
  ok: true;
  name: string;
  expiresAt: number;
  requiresPassword: boolean;
};
type ResolveErr = {
  ok: false;
  reason: "not-found" | "expired" | "revoked" | "malformed" | "bad-signature";
};
type ResolveResponse = ResolveOk | ResolveErr;

async function resolveServerSide(
  token: string,
  cookieHeader: string,
  origin: string,
): Promise<ResolveResponse | null> {
  // Internal fetch to our own route handler. We forward the cookie
  // header so the response can set/refresh the view cookie on this
  // request when the share is password-less.
  const res = await fetch(
    `${origin}/api/share/resolve?t=${encodeURIComponent(token)}`,
    {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    },
  );

  if (res.status === 404) return { ok: false, reason: "not-found" } as const;
  try {
    return (await res.json()) as ResolveResponse;
  } catch {
    return null;
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactElement> {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  const cookieHeader = hdrs.get("cookie") ?? "";

  const result = await resolveServerSide(token, cookieHeader, origin);

  if (!result) notFound();
  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Link unavailable</h1>
        <p className="text-default-600">{reasonToMessage(result.reason)}</p>
      </main>
    );
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

function reasonToMessage(reason: ResolveErr["reason"]): string {
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
