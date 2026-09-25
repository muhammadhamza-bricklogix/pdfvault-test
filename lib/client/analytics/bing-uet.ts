"use client";

export const BING_UET_TAG_ID =
  process.env.NEXT_PUBLIC_BING_UET_TAG_ID || "97271345";

/**
 * Standardize and sanitize an email address per Microsoft/Bing Ads UET specifications:
 * 1. Strip all whitespaces and accents (e.g., à -> a).
 * 2. Strip everything between '+' and '@' (e.g., name+test@domain.com -> name@domain.com).
 * 3. Remove all periods before '@' and trailing periods at the string end (e.g. ex.ample@outlook.com. -> example@outlook.com).
 * 4. Force lowercase string formatting and ensure '@' is present.
 */
export function sanitizeEmail(email?: string | null): string | null {
  if (!email || typeof email !== "string") return null;

  // Strip whitespaces, accents (NFD decomposition), and convert to lowercase
  const clean = email
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const atIndex = clean.lastIndexOf("@");
  if (atIndex <= 0) return null;

  let localPart = clean.slice(0, atIndex);
  let domainPart = clean.slice(atIndex + 1);

  // Remove everything between "+" and "@"
  const plusIndex = localPart.indexOf("+");
  if (plusIndex !== -1) {
    localPart = localPart.slice(0, plusIndex);
  }

  // Remove all periods before "@"
  localPart = localPart.replace(/\./g, "");

  // Remove trailing period(s) from the domain
  domainPart = domainPart.replace(/\.+$/, "");

  if (!localPart || !domainPart) return null;

  return `${localPart}@${domainPart}`;
}

/**
 * Standardize and sanitize a phone number to E.164 format (+[country_code][subscriber_number]).
 * Formats phone numbers according to E.164 standard (e.g., +14250000000).
 */
export function sanitizePhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== "string") return null;

  const trimmed = phone.trim();
  const stripped = trimmed.replace(/[\s\-_().]/g, "");
  if (!stripped) return null;

  let e164 = stripped;
  if (!e164.startsWith("+")) {
    e164 = `+${e164.replace(/\+/g, "")}`;
  } else {
    e164 = `+${e164.slice(1).replace(/\+/g, "")}`;
  }

  const digitsOnly = e164.slice(1);
  if (!/^\d{7,15}$/.test(digitsOnly)) {
    return null;
  }

  return e164;
}

/**
 * SHA-256 hash a UTF-8 string into a lowercase hexadecimal string.
 * Uses Web Crypto API (window.crypto.subtle).
 */
export async function sha256Hex(value: string): Promise<string> {
  if (!value) return "";

  if (typeof window !== "undefined" && window.crypto?.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(value);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Bing UET] SHA-256 computation failed:", err);
      }
    }
  }

  return value;
}

export interface BingUserData {
  email?: string | null;
  phone?: string | null;
}

/**
 * Sets enhanced user data (pid: { em, ph }) on window.uetq and window.dataLayer.
 * Sanitizes and hashes the email with SHA-256, and formats the phone to E.164.
 */
export async function setBingUserData(userData: BingUserData): Promise<void> {
  if (typeof window === "undefined") return;

  const pid: Record<string, string> = {};

  if (userData.email) {
    const cleanEmail = sanitizeEmail(userData.email);
    if (cleanEmail) {
      pid.em = await sha256Hex(cleanEmail);
    }
  }

  if (userData.phone) {
    const cleanPhone = sanitizePhone(userData.phone);
    if (cleanPhone) {
      pid.ph = cleanPhone;
    }
  }

  if (Object.keys(pid).length === 0) return;

  // 1. Push to Bing UET
  window.uetq = window.uetq || [];
  window.uetq.push("set", { pid });

  // 2. Push to GTM dataLayer for cross-platform tag mapping
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  window.dataLayer.push({
    event: "bing_user_data_set",
    user_data: pid,
  });
}

export interface BingPurchaseEventParams {
  revenue_value: number;
  currency?: string;
  orderId?: string;
}

/**
 * Fires a Bing UET 'purchase' event and pushes to window.dataLayer.
 */
export function trackBingPurchase(params: BingPurchaseEventParams): void {
  if (typeof window === "undefined") return;

  const currency = params.currency || "USD";
  const revenue_value = Number(params.revenue_value);

  // 1. Push to Bing UET
  window.uetq = window.uetq || [];
  window.uetq.push("event", "purchase", {
    revenue_value,
    currency,
  });

  // 2. Push to GTM dataLayer (mirroring GA4 ecommerce structure)
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  window.dataLayer.push({
    event: "bing_purchase",
    revenue_value,
    currency,
    orderId: params.orderId,
  });
}
