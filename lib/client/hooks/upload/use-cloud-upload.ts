"use client";

import { useCallback, useMemo, useState } from "react";

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

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const MICROSOFT_SCOPE = "Files.Read User.Read";
const POPUP_FEATURES =
  "width=520,height=700,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes,status=no";

function parseOAuthResponse(urlValue: string) {
  const url = new URL(urlValue);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = new URLSearchParams(url.search);

  return {
    accessToken: hash.get("access_token") ?? query.get("access_token"),
    error: hash.get("error") ?? query.get("error"),
    errorDescription:
      hash.get("error_description") ?? query.get("error_description"),
    state: hash.get("state") ?? query.get("state"),
  };
}

async function runOAuthPopup({ timeoutMs = 120000, url }: OAuthPopupOptions) {
  const popup = window.open(url, "_blank", POPUP_FEATURES);

  if (!popup) {
    throw new Error("Unable to open sign-in popup. Please allow popups.");
  }

  return new Promise<{ accessToken: string; state: string | null }>(
    (resolve, reject) => {
      const startedAt = Date.now();
      const interval = window.setInterval(() => {
        try {
          if (popup.closed) {
            window.clearInterval(interval);
            reject(new Error("Sign-in popup was closed."));

            return;
          }

          if (Date.now() - startedAt > timeoutMs) {
            window.clearInterval(interval);
            popup.close();
            reject(new Error("Sign-in timed out. Please try again."));

            return;
          }

          const href = popup.location.href;

          if (!href.startsWith(window.location.origin)) return;

          const parsed = parseOAuthResponse(href);

          window.clearInterval(interval);
          popup.close();

          if (parsed.error) {
            reject(
              new Error(
                parsed.errorDescription ??
                  parsed.error.replace(/_/g, " ") ??
                  "Sign-in failed.",
              ),
            );

            return;
          }

          if (!parsed.accessToken) {
            reject(new Error("No access token was returned by the provider."));

            return;
          }

          resolve({
            accessToken: parsed.accessToken,
            state: parsed.state,
          });
        } catch {
          // Cross-origin popup is expected before redirect; keep polling.
        }
      }, 400);
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
    const redirectUri = `${window.location.origin}/`;
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

    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size)&pageSize=25&orderBy=modifiedTime desc",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error("Could not load files from Google Drive.");
    }

    const data = (await response.json()) as {
      files?: Array<{
        id: string;
        mimeType?: string;
        name: string;
        size?: string;
      }>;
    };

    const mapped = (data.files ?? []).map((file) => ({
      accessToken,
      id: file.id,
      mimeType: file.mimeType,
      name: file.name,
      provider: "gdrive" as const,
      size: file.size ? Number(file.size) : undefined,
    }));

    return mapped;
  }, []);

  const beginOneDriveFlow = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
    const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID ?? "common";

    if (!clientId) {
      throw new Error("Missing NEXT_PUBLIC_MICROSOFT_CLIENT_ID.");
    }

    const state = crypto.randomUUID();
    const redirectUri = `${window.location.origin}/`;
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
    async (provider: CloudProvider) => {
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

        setItems(nextItems);
        setStatus("idle");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to start cloud upload.";

        setError(message);
        setStatus("error");
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
