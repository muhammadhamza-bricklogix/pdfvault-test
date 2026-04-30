import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import axios, { AxiosError } from "axios";

import {
  getAuthToken,
  signOutAndRedirect,
} from "@/lib/client/auth/get-auth-token";
import { toApiError } from "@/lib/shared/utils/api-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _hadToken?: boolean;
};

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
