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
import { getEntitledSnapshot } from "@/lib/client/hooks/billing/entitlement-cache";
import {
  PaywallCancelledError,
  requestPaywall,
} from "@/lib/client/hooks/billing/paywall-bus";
import { toApiError } from "@/lib/shared/utils/api-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * Path prefixes that require an active subscription. Matched by
 * `startsWith` against the request URL (both absolute and relative
 * forms work — the interceptor normalises before checking). Kept as a
 * const array so it's greppable and easy to audit.
 *
 * Note: /billing/* itself is NOT gated — otherwise the paywall would
 * paywall itself and deadlock.
 */
const PAYWALL_GATED_PREFIXES = [
  "/conversion",
  "/pdf-tools/compress",
  "/pdf-tools/encrypt",
  "/pdf-tools/decrypt",
  "/pdf-tools/flatten",
  "/pdf-tools/extract-images",
  "/shares",
];

/**
 * Backend response header the entitlement check middleware could set
 * to bypass the client-side gate — used for internal service-to-service
 * calls that shouldn't trigger a modal. Not currently emitted; reserved
 * for Phase 8 defense-in-depth work.
 */
const BYPASS_HEADER = "x-billing-bypass";

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _hadToken?: boolean;
  _paywallRetry?: boolean;
};

function isGatedRequest(config: InternalAxiosRequestConfig): boolean {
  const url = config.url ?? "";
  // Strip baseURL if the caller passed an absolute URL.
  const path = url.startsWith(API_BASE_URL)
    ? url.slice(API_BASE_URL.length)
    : url;

  return PAYWALL_GATED_PREFIXES.some((prefix) => path.startsWith(prefix));
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

  // Pre-flight paywall check for gated endpoints. If the cached
  // entitlement snapshot says the user is NOT entitled, fire the
  // paywall right here so we skip a wasted round-trip that we already
  // know would be rejected. The response interceptor's 402/403 branch
  // is still the safety net for stale snapshots and server-side edge
  // cases.
  if (isGatedRequest(config) && !getEntitledSnapshot()) {
    const outcome = await requestPaywall();

    if (outcome !== "success") {
      throw new PaywallCancelledError();
    }
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

    // Paywall gate — a 402 (or 403 with `x-billing-required` header)
    // from a gated endpoint means the user's subscription lapsed
    // mid-session. Open the paywall, wait for payment, and retry the
    // original request exactly once. Cancelled paywalls surface a
    // dedicated error so the caller can toast "Payment required" instead
    // of a generic "network error".
    const gated = original ? isGatedRequest(original) : false;
    const paywallSignal =
      status === 402 ||
      (status === 403 &&
        (error.response?.headers?.["x-billing-required"] === "true" ||
          error.response?.headers?.[BYPASS_HEADER] !== "true"));

    if (gated && paywallSignal && original && !original._paywallRetry) {
      original._paywallRetry = true;
      const outcome = await requestPaywall();

      if (outcome === "success") {
        return apiClient.request(original);
      }

      return Promise.reject(new PaywallCancelledError());
    }

    return Promise.reject(toApiError(error));
  },
);
