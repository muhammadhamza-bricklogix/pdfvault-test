"use client";

import { useCallback, useMemo, useState } from "react";

import { pickGoogleDrivePdfFiles } from "@/lib/client/utils/google-drive-picker";

export type CloudProvider = "gdrive" | "onedrive";
export type CloudUploadStatus =
  | "idle"
  | "authenticating"
  | "fetching"
  | "selected"
  | "error";

export type CloudBrowserItem = {
  accessToken: string;
  id: string;
  mimeType?: string;
  name: string;
  provider: CloudProvider;
  size?: number;
};

export type CloudSelectedFile = CloudBrowserItem;

type OAuthPopupOptions = {
  timeoutMs?: number;
  url: string;
};

// Non-sensitive scope. Grants access ONLY to files the user picks through the
// Google Picker (or that this app creates) — not the whole Drive. Requires the
// PickerBuilder to call `.setOAuthToken(accessToken)` so each pick emits a
// per-file grant against THIS OAuth client; without it, the backend
// `files.get` would 403. Verified in `google-drive-picker.ts`.
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const MICROSOFT_SCOPE = "Files.Read User.Read";
const POPUP_FEATURES =
  "width=520,height=700,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes,status=no";
const OAUTH_CALLBACK_PATH = "/oauth-callback";

type OAuthMessagePayload = {
  accessToken: string | null;
  error: string | null;
  errorDescription: string | null;
  source: "pdfedits-oauth";
  state: string | null;
};

/**
 * Build the redirect URI used by both the Google and Microsoft popups.
 * Has to live on the SAME origin as the parent window so the callback
 * page can call `window.opener.postMessage` back to us — and has to match
 * the URI whitelisted in the OAuth client's console exactly (scheme + host
 * + port + path, no trailing slash).
 */
function buildRedirectUri(): string {
  return `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
}

/**
 * Drive the OAuth popup via `postMessage` instead of polling
 * `popup.location.href`.
 *
 * Previously: the parent ran a 400ms `setInterval` reading `popup.closed`
 * and `popup.location.href`. Modern browsers block both reads under the
 * `Cross-Origin-Opener-Policy` header (Next.js + Vercel + Clerk all ship
 * COOP=`same-origin` by default), which produced the console error chain
 * users saw and left the picker waiting forever even after a successful
 * Google sign-in.
 *
 * Now: `/oauth-callback` (rendered in this app, same origin as parent)
 * parses the token from the URL hash and posts it back to `window.opener`.
 * The parent only has to listen — no cross-origin property reads.
 */
const OAUTH_STORAGE_KEY = "pdfedits:oauth-result";

const isDev = process.env.NODE_ENV !== "production";
const log = (...args: unknown[]) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[runOAuthPopup]", ...args);
  }
};

async function runOAuthPopup({ timeoutMs = 120000, url }: OAuthPopupOptions) {
  // Clear any stale storage payload from a previous flow before we start —
  // otherwise the parent's `storage` listener could trip on its own old
  // write.
  try {
    window.localStorage.removeItem(OAUTH_STORAGE_KEY);
  } catch {
    // Ignore — same-origin localStorage can be disabled in private mode.
  }

  const popup = window.open(url, "_blank", POPUP_FEATURES);

  if (!popup) {
    throw new Error("Unable to open sign-in popup. Please allow popups.");
  }

  return new Promise<{ accessToken: string; state: string | null }>(
    (resolve, reject) => {
      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        window.removeEventListener("storage", onStorage);
        window.clearInterval(closedPoll);
        window.clearTimeout(timer);
        try {
          window.localStorage.removeItem(OAUTH_STORAGE_KEY);
        } catch {
          // Ignore.
        }
        try {
          if (!popup.closed) popup.close();
        } catch {
          // Closing across COOP may throw — ignore.
        }
      };

      // Guard so the closedPoll interval doesn't reject after we have
      // already received and processed the token.
      let hasReceived = false;

      const handlePayload = (data: Partial<OAuthMessagePayload>) => {
        if (hasReceived) return;
        hasReceived = true;
        cleanup();

        if (data.error) {
          reject(
            new Error(
              data.errorDescription ??
                data.error.replace(/_/g, " ") ??
                "Sign-in failed.",
            ),
          );

          return;
        }

        if (!data.accessToken) {
          reject(new Error("No access token was returned by the provider."));

          return;
        }

        // Notify the popup that we got the token so it can close
        // immediately instead of waiting for the auto-close timeout.
        try {
          if (popup && !popup.closed) {
            popup.postMessage(
              { source: "pdfedits-oauth-ack" },
              window.location.origin,
            );
          }
        } catch {
          // COOP may block postMessage to the popup — ignore.
        }

        resolve({
          accessToken: data.accessToken,
          state: data.state ?? null,
        });
      };

      const onMessage = (event: MessageEvent) => {
        // eslint-disable-next-line no-console
        console.log(
          "[runOAuthPopup] raw message event:",
          event.origin,
          event.data,
        );
        if (event.origin !== window.location.origin) {
          log("message origin mismatch, ignoring", event.origin);

          return;
        }
        const data = event.data as Partial<OAuthMessagePayload> | null;

        if (!data || data.source !== "pdfedits-oauth") return;
        log("message received", {
          accessToken: data.accessToken ? "present" : null,
          error: data.error,
        });
        handlePayload(data);
      };

      // Storage-event fallback. When strict COOP severs `window.opener` in
      // the popup, our callback page can't `postMessage` — instead it
      // writes the token to `localStorage`. The `storage` event fires in
      // OTHER same-origin windows (i.e. this one), so the parent still
      // gets the payload.
      const onStorage = (event: StorageEvent) => {
        // eslint-disable-next-line no-console
        console.log(
          "[runOAuthPopup] raw storage event:",
          event.key,
          event.newValue?.slice(0, 30),
        );
        if (event.key !== OAUTH_STORAGE_KEY || !event.newValue) return;
        try {
          const data = JSON.parse(
            event.newValue,
          ) as Partial<OAuthMessagePayload> | null;

          if (!data || data.source !== "pdfedits-oauth") return;
          log("storage received", {
            accessToken: data.accessToken ? "present" : null,
            error: data.error,
          });
          handlePayload(data);
        } catch (err) {
          log("storage payload parse failed", err);
        }
      };

      // Last-chance recovery: drain localStorage synchronously and try to
      // settle from a payload that's already been written there. Used when
      // the popup closes (or the timer fires) before the `storage` event
      // had a chance to deliver — which we've seen happen on Chrome under
      // strict COOP, where Google's own redirect handling can race the
      // popup close with our event-loop turn. Returns true if a usable
      // payload was found and consumed.
      const drainStoredPayload = (): boolean => {
        try {
          const raw = window.localStorage.getItem(OAUTH_STORAGE_KEY);

          if (!raw) return false;
          const data = JSON.parse(raw) as Partial<OAuthMessagePayload> | null;

          if (!data || data.source !== "pdfedits-oauth") return false;
          log("recovered payload from localStorage on fallback");
          handlePayload(data);

          return hasReceived;
        } catch (err) {
          log("localStorage drain failed", err);

          return false;
        }
      };

      // Best-effort "user closed the popup" detector. Under strict COOP
      // `popup.closed` reads throw a SecurityError DOMException — caught
      // + silently dropped. Anything else (genuinely unexpected) gets
      // logged once via a memo so the console doesn't drown in repeats.
      let unexpectedCloseError = false;
      const closedPoll = window.setInterval(() => {
        try {
          if (popup.closed) {
            // If we already received the token but the popup hasn't been
            // closed by cleanup() yet, don't treat this as an error.
            if (hasReceived) {
              return;
            }
            // Race: the popup wrote its token to localStorage right
            // before closing, but the `storage` event hasn't reached us
            // yet (or never will — Chrome occasionally drops `storage`
            // events when the writing window unloads in the same task).
            // Give the event loop a brief grace, then drain localStorage
            // synchronously. If a payload is there, we settle via that;
            // otherwise treat it as a genuine cancel.
            window.clearInterval(closedPoll);
            window.setTimeout(() => {
              if (hasReceived) return;
              if (drainStoredPayload()) return;
              cleanup();
              reject(new Error("Sign-in popup was closed."));
            }, 300);
          }
        } catch (err) {
          if (
            err instanceof DOMException &&
            /coop|cross-origin-opener|security/i.test(err.message)
          ) {
            return;
          }
          if (!unexpectedCloseError) {
            unexpectedCloseError = true;
            // eslint-disable-next-line no-console
            console.warn(
              "[runOAuthPopup] unexpected popup.closed read error:",
              err,
            );
          }
        }
      }, 500);

      const timer = window.setTimeout(() => {
        // Same recovery path as the popup-close branch: a slow OAuth
        // round-trip may have written the token to storage but missed the
        // event. Don't time out without checking.
        if (drainStoredPayload()) return;
        cleanup();
        reject(new Error("Sign-in timed out. Please try again."));
      }, timeoutMs);

      window.addEventListener("message", onMessage);
      window.addEventListener("storage", onStorage);
      log("listeners attached, awaiting OAuth callback");
    },
  );
}

export function useCloudUpload() {
  const [activeProvider, setActiveProvider] = useState<CloudProvider | null>(
    null,
  );
  const [status, setStatus] = useState<CloudUploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CloudBrowserItem[]>([]);
  const [selected, setSelected] = useState<CloudSelectedFile | null>(null);

  const beginGoogleFlow = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
    }

    const state = crypto.randomUUID();
    const redirectUri = buildRedirectUri();

    // eslint-disable-next-line no-console
    console.log("[beginGoogleFlow] redirectUri =", redirectUri);
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", GOOGLE_SCOPE);
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const { accessToken, state: returnedState } = await runOAuthPopup({
      url: authUrl.toString(),
    });

    if (returnedState !== state) {
      throw new Error("Security check failed during Google sign-in.");
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_GOOGLE_API_KEY. Create a browser API key in Google Cloud, enable the Picker API, and add it to your env.",
      );
    }

    const picked = await pickGoogleDrivePdfFiles(accessToken, apiKey);

    return picked as CloudBrowserItem[];
  }, []);

  const beginOneDriveFlow = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
    const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID ?? "common";

    if (!clientId) {
      throw new Error("Missing NEXT_PUBLIC_MICROSOFT_CLIENT_ID.");
    }

    const state = crypto.randomUUID();
    const redirectUri = buildRedirectUri();
    const authUrl = new URL(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    );

    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("response_mode", "fragment");
    authUrl.searchParams.set("scope", MICROSOFT_SCOPE);
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", state);

    const { accessToken, state: returnedState } = await runOAuthPopup({
      url: authUrl.toString(),
    });

    if (returnedState !== state) {
      throw new Error("Security check failed during OneDrive sign-in.");
    }

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,size,file,folder",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error("Could not load files from OneDrive.");
    }

    const data = (await response.json()) as {
      value?: Array<{
        file?: { mimeType?: string };
        folder?: unknown;
        id: string;
        name: string;
        size?: number;
      }>;
    };

    const mapped = (data.value ?? [])
      .filter((item) => !item.folder)
      .map((item) => ({
        accessToken,
        id: item.id,
        mimeType: item.file?.mimeType,
        name: item.name,
        provider: "onedrive" as const,
        size: item.size,
      }));

    return mapped;
  }, []);

  const start = useCallback(
    async (provider: CloudProvider): Promise<CloudBrowserItem[]> => {
      setActiveProvider(provider);
      setStatus("authenticating");
      setError(null);
      setItems([]);

      try {
        setStatus("fetching");
        const nextItems =
          provider === "gdrive"
            ? await beginGoogleFlow()
            : await beginOneDriveFlow();

        if (provider === "onedrive") {
          setItems(nextItems);
        }

        setStatus("idle");

        return nextItems;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to start cloud upload.";

        setError(message);
        setStatus("error");

        return [];
      }
    },
    [beginGoogleFlow, beginOneDriveFlow],
  );

  const selectCloudFile = useCallback((item: CloudBrowserItem) => {
    setSelected(item);
    setStatus("selected");
    setError(null);
  }, []);

  const clearTransient = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  const isBusy = useMemo(
    () => status === "authenticating" || status === "fetching",
    [status],
  );

  return {
    activeProvider,
    clearTransient,
    error,
    isBusy,
    items,
    selected,
    selectCloudFile,
    start,
    status,
  };
}
