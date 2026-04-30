import { logger } from "@/lib/shared/utils/logger";

type ClerkGlobal = {
  loaded?: boolean;
  load?: () => Promise<void>;
  session?: {
    getToken: (options?: { skipCache?: boolean }) => Promise<string | null>;
  } | null;
  signOut?: (options?: { redirectUrl?: string }) => Promise<void>;
};

export function getClerk(): ClerkGlobal | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Clerk?: ClerkGlobal };

  return w.Clerk ?? null;
}

/**
 * Wait for the Clerk runtime to hydrate. Without this, the first request
 * after a navigation can race Clerk's async load — we'd send with no token.
 */
export async function waitForClerk(
  timeoutMs = 3000,
): Promise<ClerkGlobal | null> {
  if (typeof window === "undefined") return null;

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const clerk = getClerk();

    if (clerk?.loaded) return clerk;
    if (clerk?.load) {
      try {
        await clerk.load();

        return getClerk();
      } catch (error) {
        logger.error("Clerk failed to load", error);

        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return getClerk();
}

export async function getAuthToken(skipCache = false): Promise<string | null> {
  const clerk = await waitForClerk();

  if (!clerk?.session) return null;

  try {
    return await clerk.session.getToken({ skipCache });
  } catch (error) {
    logger.error("Failed to get Clerk token", error);

    return null;
  }
}

export async function signOutAndRedirect(): Promise<void> {
  const clerk = getClerk();

  if (clerk?.signOut) {
    await clerk.signOut({ redirectUrl: "/sign-in" });
  } else if (typeof window !== "undefined") {
    window.location.href = "/sign-in";
  }
}
