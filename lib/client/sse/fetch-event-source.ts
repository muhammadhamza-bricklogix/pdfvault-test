import { getAuthToken } from "@/lib/client/auth/get-auth-token";
import { logger } from "@/lib/shared/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type SseEvent = {
  id?: string;
  event?: string;
  data: string;
};

export type FetchEventSourceOptions<T> = {
  /** Path or absolute URL. Path is prefixed with NEXT_PUBLIC_API_BASE_URL. */
  url: string;
  signal: AbortSignal;
  /** Called for every parsed event (after JSON.parse on `data`). */
  onEvent: (data: T, raw: SseEvent) => void;
  onError?: (error: unknown) => void;
  /** Called once the server closes the stream cleanly. */
  onClose?: () => void;
};

function resolveUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Minimal fetch-based SSE client. Unlike native EventSource, this lets us
 * attach the Clerk bearer token. Reconnects up to 2 times on network errors
 * (not on 4xx). Caller controls lifecycle via `signal`.
 */
export async function fetchEventSource<T>(
  opts: FetchEventSourceOptions<T>,
): Promise<void> {
  const { url, signal, onEvent, onError, onClose } = opts;
  let lastEventId: string | undefined;
  let attempt = 0;
  const MAX_ATTEMPTS = 3;

  while (attempt < MAX_ATTEMPTS) {
    if (signal.aborted) return;
    attempt += 1;

    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      };

      if (token) headers.Authorization = `Bearer ${token}`;
      if (lastEventId) headers["Last-Event-ID"] = lastEventId;

      const response = await fetch(resolveUrl(url), {
        headers,
        method: "GET",
        signal,
      });

      if (!response.ok) {
        // 4xx: do not retry. 5xx: retry.
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`SSE request failed: ${response.status}`);
        }
        throw Object.assign(
          new Error(`SSE request failed: ${response.status}`),
          {
            retryable: true,
          },
        );
      }

      if (!response.body) {
        throw new Error("SSE response has no body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onClose?.();

          return;
        }

        buffer += decoder.decode(value, { stream: true });

        let separatorIndex = buffer.indexOf("\n\n");

        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);

          buffer = buffer.slice(separatorIndex + 2);

          const parsed = parseEvent(rawEvent);

          if (parsed) {
            if (parsed.id) lastEventId = parsed.id;
            try {
              const data = JSON.parse(parsed.data) as T;

              onEvent(data, parsed);
            } catch (err) {
              logger.error("SSE: failed to JSON.parse event data", err);
            }
          }

          separatorIndex = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (signal.aborted) return;

      const retryable = (error as { retryable?: boolean }).retryable;

      if (!retryable || attempt >= MAX_ATTEMPTS) {
        onError?.(error);

        return;
      }

      // Backoff: 500ms, 1500ms
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * attempt * attempt),
      );
    }
  }
}

function parseEvent(raw: string): SseEvent | null {
  if (!raw.trim()) return null;
  const result: SseEvent = { data: "" };
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colonIndex = line.indexOf(":");
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const value =
      colonIndex === -1 ? "" : line.slice(colonIndex + 1).replace(/^ /, "");

    if (field === "id") result.id = value;
    else if (field === "event") result.event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  result.data = dataLines.join("\n");

  return result;
}
