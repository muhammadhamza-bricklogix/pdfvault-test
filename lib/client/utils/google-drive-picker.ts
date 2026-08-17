"use client";

export type PickedGoogleDrivePdf = {
  accessToken: string;
  id: string;
  mimeType?: string;
  name: string;
  provider: "gdrive";
  size?: number;
};

let pickerApiLoadPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);

    if (existing) {
      resolve();

      return;
    }

    const script = document.createElement("script");

    script.async = true;
    script.src = src;
    script.onload = () => {
      resolve();
    };
    script.onerror = (err) => {
      // Surface load failures in the console — CSP blocks and offline
      // states otherwise just produce a silent reject deep inside the
      // picker promise chain.
      // eslint-disable-next-line no-console
      console.error("[google-drive-picker] script load failed:", src, err);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

function ensureGooglePickerLoaded(): Promise<void> {
  pickerApiLoadPromise ??= (async () => {
    await loadScript("https://apis.google.com/js/api.js");
    const gapi = (
      window as unknown as {
        gapi?: {
          load: (
            api: string,
            options: { callback: () => void; onerror?: (err: unknown) => void },
          ) => void;
        };
      }
    ).gapi;

    if (!gapi) {
      throw new Error("Google API script did not expose gapi.");
    }

    await new Promise<void>((resolve, reject) => {
      gapi.load("picker", {
        callback: () => {
          resolve();
        },
        onerror: (err: unknown) => {
          reject(
            err instanceof Error
              ? err
              : new Error("Failed to load Google Picker API."),
          );
        },
      });
    });
  })();

  return pickerApiLoadPromise;
}

/**
 * Opens the official Google Drive file picker (PDF files only).
 * Requires the Picker API enabled in Google Cloud, a browser API key
 * (`NEXT_PUBLIC_GOOGLE_API_KEY`), and the Cloud project number
 * (`NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER`). The project number is required
 * so per-file grants issued under `drive.file` are scoped to THIS app —
 * without it Drive's gadget endpoint 401s on the picked file.
 */
export async function pickGoogleDrivePdfFiles(
  accessToken: string,
  developerKey: string,
  appId: string,
): Promise<PickedGoogleDrivePdf[]> {
  if (!developerKey || developerKey.length < 10) {
    throw new Error(
      "Google API Key is missing or looks invalid. " +
        "Ensure NEXT_PUBLIC_GOOGLE_API_KEY is set and the Picker API is enabled in Google Cloud Console.",
    );
  }

  if (!appId || !/^\d+$/.test(appId)) {
    throw new Error(
      "Google Cloud project number is missing or invalid. " +
        "Set NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER to the numeric project number (the prefix before the dash in your OAuth client ID).",
    );
  }

  if (!accessToken || accessToken.length < 10) {
    throw new Error(
      "Google OAuth access token is missing. Please try signing in again.",
    );
  }

  await ensureGooglePickerLoaded();

  const google = (window as unknown as { google?: { picker: unknown } }).google;

  if (!google?.picker) {
    throw new Error("Google Picker is not available in this browser.");
  }

  const pickerNs = google.picker as {
    Action: { CANCEL: string; LOADED: string; PICKED: string };
    DocsView: new () => {
      setIncludeFolders: (v: boolean) => unknown;
      setMimeTypes: (mime: string) => unknown;
    };
    PickerBuilder: new () => unknown;
  };

  const { Action, DocsView, PickerBuilder } = pickerNs;

  type DocsViewInstance = {
    setIncludeFolders: (v: boolean) => DocsViewInstance;
    setMimeTypes: (mime: string) => DocsViewInstance;
  };

  const DocsViewCtor = DocsView as new () => DocsViewInstance;

  type PickerBuilderInstance = {
    addView: (v: unknown) => PickerBuilderInstance;
    setOAuthToken: (t: string) => PickerBuilderInstance;
    setDeveloperKey: (k: string) => PickerBuilderInstance;
    setAppId: (id: string) => PickerBuilderInstance;
    setCallback: (
      cb: (data: Record<string, unknown>) => void,
    ) => PickerBuilderInstance;
    build: () => { setVisible: (v: boolean) => void };
  };

  const PickerBuilderCtor = PickerBuilder as new () => PickerBuilderInstance;

  return new Promise<PickedGoogleDrivePdf[]>((resolve, reject) => {
    // One-shot settle guard — Google Picker can fire multiple callbacks
    // per lifecycle (e.g. "loaded" then "picked", or duplicate dispatches
    // from browser quirks). We only want the first conclusive event
    // (picked / cancel / error) to settle the promise.
    let settled = false;
    // Tracks whether the picker UI actually rendered. A `cancel` that fires
    // before `loaded` almost always means Google refused to mount the picker
    // (API key not authorized for this origin, Picker API disabled, or wrong
    // project number). Without this flag we silently return `count: 0` and
    // callers treat it as a user-dismiss.
    let hasLoaded = false;
    const settleResolve = (value: PickedGoogleDrivePdf[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      resolve(value);
    };
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      reject(err);
    };

    // Safety net: if the picker never fires a conclusive callback (loaded,
    // picked, cancel, or error) the promise would hang forever. This timer
    // rejects so the UI can recover and show a useful message.
    const safetyTimer = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error(
        "[google-drive-picker] timed out waiting for a picker callback — " +
          "the picker dialog likely failed to open.",
        { hasLoaded, origin: window.location.origin, appId },
      );
      settleReject(
        new Error(
          `Google Drive picker did not respond. ` +
            `Check that the Picker API is enabled and the API key is ` +
            `authorized for "${window.location.origin}/*".`,
        ),
      );
    }, 15000);

    const view = new DocsViewCtor()
      .setIncludeFolders(true)
      .setMimeTypes("application/pdf");

    try {
      new PickerBuilderCtor()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(developerKey)
        .setAppId(appId)
        .setCallback((data: Record<string, unknown>) => {
          const action = data.action as string | undefined;

          // Always log the raw action — production too. Silent `cancel`
          // fires that turn into `count: 0` are the main reason we can't
          // tell whether the picker actually opened; this lets us diff
          // "loaded then cancel" (user closed) vs "cancel with no loaded"
          // (Google refused to mount, usually API-key/referrer misconfig).
          // eslint-disable-next-line no-console
          console.log("[google-drive-picker] callback", {
            action,
            dataKeys: Object.keys(data),
            error: data.error,
            docsLength: Array.isArray(data.docs)
              ? (data.docs as unknown[]).length
              : undefined,
          });

          if (action === Action.LOADED || action === "loaded") {
            hasLoaded = true;

            return;
          }

          if (action === Action.PICKED || action === "picked") {
            hasLoaded = true;
            const raw = (data.docs ?? []) as Array<{
              id?: string;
              mimeType?: string;
              name?: string;
              sizeBytes?: number | string;
            }>;
            const mapped: PickedGoogleDrivePdf[] = raw
              .filter((d) => d.id && d.name)
              .map((d) => ({
                accessToken,
                id: d.id as string,
                mimeType: d.mimeType,
                name: d.name as string,
                provider: "gdrive" as const,
                size:
                  d.sizeBytes === undefined || d.sizeBytes === null
                    ? undefined
                    : Number(d.sizeBytes),
              }));

            settleResolve(mapped);

            return;
          }

          // User-initiated dismiss — empty selection is the correct answer.
          if (action === Action.CANCEL || action === "cancel") {
            if (hasLoaded) {
              settleResolve([]);

              return;
            }

            // Cancel without the picker ever loading is not a user dismiss;
            // it is Google refusing to mount the dialog. Surface a clear,
            // actionable error instead of returning `count: 0`.
            // eslint-disable-next-line no-console
            console.error(
              "[google-drive-picker] cancel fired before picker loaded — " +
                "this usually means the API key is not authorized for this " +
                "origin or the Picker API is disabled.",
              { origin: window.location.origin, appId },
            );
            settleReject(
              new Error(
                `Google Drive picker could not open. ` +
                  `Check that the Picker API is enabled in Google Cloud Console, ` +
                  `and that the API key is authorized for "${window.location.origin}/*".`,
              ),
            );

            return;
          }

          // Anything else — "error" or any future lifecycle action we
          // don't know about. The Picker doesn't always populate
          // `data.error`; include the raw action name so the surfaced
          // message is useful.
          const dataError =
            typeof data.error === "string" && data.error.length > 0
              ? data.error
              : null;

          // Provide actionable messages for the most common failure modes.
          let message: string;

          if (action === "error") {
            if (
              dataError?.includes("origin") ||
              dataError?.includes("referrer") ||
              dataError?.includes("API key")
            ) {
              message =
                `Google Drive picker failed because the API key is not ` +
                `authorized for this origin (${window.location.origin}). ` +
                `Go to Google Cloud Console → Credentials → API keys, ` +
                `and add "${window.location.origin}/*" to the HTTP referrers.`;
            } else if (dataError?.includes("token")) {
              message =
                `Google Drive picker failed due to an invalid OAuth token. ` +
                `Please sign in again.`;
            } else {
              message =
                `Google Drive picker encountered an error` +
                (dataError ? `: ${dataError}` : "");
            }
          } else {
            message =
              `Google Drive picker fired unexpected action ` +
              `"${action ?? "(unknown)"}"` +
              (dataError ? `: ${dataError}` : "");
          }

          // eslint-disable-next-line no-console
          console.error("[google-drive-picker] picker callback error", {
            action,
            data,
          });
          settleReject(new Error(message));
        })
        .build()
        .setVisible(true);
      // eslint-disable-next-line no-console
      console.log("[google-drive-picker] setVisible(true) called", {
        appIdLen: appId.length,
        keyLen: developerKey.length,
        tokenLen: accessToken.length,
        origin: window.location.origin,
      });
    } catch (err) {
      // Synchronous Picker construction error — origin / API key / SDK
      // load problems can throw here.
      // eslint-disable-next-line no-console
      console.error("[google-drive-picker] PickerBuilder threw", err);
      settleReject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
