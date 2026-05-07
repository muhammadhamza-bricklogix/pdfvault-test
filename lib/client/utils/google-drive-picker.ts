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
    script.onerror = () => {
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
    Action: { CANCEL: string; PICKED: string };
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

  return new Promise((resolve) => {
    const view = new DocsViewCtor()
      .setIncludeFolders(true)
      .setMimeTypes("application/pdf");

    new PickerBuilderCtor()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(developerKey)
      .setCallback((data: Record<string, unknown>) => {
        const action = data.action as string | undefined;

        if (action === Action.PICKED) {
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

          resolve(mapped);

          return;
        }

        resolve([]);
      })
      .build()
      .setVisible(true);
  });
}
