import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import axios, { AxiosError } from "axios";

import { toApiError } from "@/lib/shared/utils/api-error";
import { logger } from "@/lib/shared/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _hadToken?: boolean;
};

type ClerkGlobal = {
  loaded?: boolean;
  load?: () => Promise<void>;
  session?: {
    getToken: (options?: { skipCache?: boolean }) => Promise<string | null>;
  } | null;
  signOut?: (options?: { redirectUrl?: string }) => Promise<void>;
};

function getClerk(): ClerkGlobal | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Clerk?: ClerkGlobal };

  return w.Clerk ?? null;
}

/**
 * Wait for the Clerk runtime to hydrate. Without this, the first request
 * after a navigation can race Clerk's async load — we'd send with no token,
 * get a 401, and the interceptor would force a sign-out for an authed user.
 */
async function waitForClerk(timeoutMs = 3000): Promise<ClerkGlobal | null> {
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

async function getAuthToken(skipCache = false): Promise<string | null> {
  const clerk = await waitForClerk();

  if (!clerk?.session) return null;

  try {
    return await clerk.session.getToken({ skipCache });
  } catch (error) {
    logger.error("Failed to get Clerk token", error);

    return null;
  }
}

async function signOutAndRedirect(): Promise<void> {
  const clerk = getClerk();

  if (clerk?.signOut) {
    await clerk.signOut({ redirectUrl: "/sign-in" });
  } else if (typeof window !== "undefined") {
    window.location.href = "/sign-in";
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
    (config as RetriableConfig)._hadToken = true;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Unwrap the standard `{ success, message, data }` envelope so callers can
    // type `apiClient.get<Document>(...)` and read `response.data` directly.
    const body = response.data;

    if (
      body &&
      typeof body === "object" &&
      "success" in body &&
      "data" in body
    ) {
      response.data = (body as { data: unknown }).data;
    }

    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetriableConfig | undefined;

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const fresh = await getAuthToken(true);

      if (fresh) {
        original.headers?.set("Authorization", `Bearer ${fresh}`);

        return apiClient.request(original);
      }

      // Only force sign-out if we actually authed this request and the
      // server still rejected it. If we never had a token (Clerk hadn't
      // loaded, or the user is signed out), let the caller handle the 401.
      if (original._hadToken) {
        await signOutAndRedirect();
      }
    }

    return Promise.reject(toApiError(error));
  },
);
