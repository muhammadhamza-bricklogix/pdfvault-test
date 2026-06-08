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
 * Requires the Picker API enabled in Google Cloud and a browser API key
 * (`NEXT_PUBLIC_GOOGLE_API_KEY`).
 */
export async function pickGoogleDrivePdfFiles(
  accessToken: string,
  developerKey: string,
): Promise<PickedGoogleDrivePdf[]> {
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
    const settleResolve = (value: PickedGoogleDrivePdf[]) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const view = new DocsViewCtor()
      .setIncludeFolders(true)
      .setMimeTypes("application/pdf");

    try {
      new PickerBuilderCtor()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(developerKey)
        .setCallback((data: Record<string, unknown>) => {
          const action = data.action as string | undefined;

          // Picker UI finished mounting — fired BEFORE the user picks
          // anything. Not an error, not a settle event. Log for dev
          // visibility only.
          if (action === Action.LOADED || action === "loaded") {
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.info("[google-drive-picker] picker loaded");
            }

            return;
          }

          if (action === Action.PICKED || action === "picked") {
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
            settleResolve([]);

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
          const message =
            `Google Drive picker fired unexpected action ` +
            `"${action ?? "(unknown)"}"` +
            (dataError ? `: ${dataError}` : "");

          // eslint-disable-next-line no-console
          console.error("[google-drive-picker] picker callback error", {
            action,
            data,
          });
          settleReject(new Error(message));
        })
        .build()
        .setVisible(true);
    } catch (err) {
      // Synchronous Picker construction error — origin / API key / SDK
      // load problems can throw here.
      // eslint-disable-next-line no-console
      console.error("[google-drive-picker] PickerBuilder threw", err);
      settleReject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
