import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import axios, { AxiosError } from "axios";

import { logger } from "@/lib/shared/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type ClerkGlobal = {
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

async function getAuthToken(skipCache = false): Promise<string | null> {
  const clerk = getClerk();

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
  baseURL: "https://febf-139-135-40-175.ngrok-free.app/",
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
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
      await signOutAndRedirect();
    }

    return Promise.reject(error);
  },
);
