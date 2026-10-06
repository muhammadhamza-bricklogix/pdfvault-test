import {
  clearStoredAcquisition,
  getStoredAcquisition,
} from "@/lib/client/analytics/acquisition-tracker";
import { apiClient } from "@/lib/config/api-client";
import { USERS } from "@/lib/shared/constants/endpoints";

/**
 * Idempotently provision the local User row for the currently signed-in
 * Clerk session. Safe to call repeatedly. The backend uses Prisma `upsert`,
 * so two near-simultaneous calls don't race.
 *
 * Why this exists: previously the ONLY backend path that materialized a
 * local User row was `documents.upload`, which meant a just-signed-up user's
 * first action (uploading a doc) could lose a race with Clerk's
 * `user.created` webhook and 500. Calling this immediately after sign-in
 * closes that window.
 *
 * Forwards client-side first-touch acquisition attribution (Google Ads,
 * Bing Ads, Direct, etc.) so it can be associated with the user record.
 */
async function ensureMe(): Promise<void> {
  const attribution = getStoredAcquisition();

  await apiClient.post(USERS.ME, attribution ?? {});
}

/**
 * Records a sign-out event in the backend audit log. The Clerk session is
 * still destroyed by `useClerk().signOut()` — this just persists the "who
 * logged out, when, from where" trail for support / abuse triage.
 *
 * Also clears any stored acquisition tracking from cookies and localStorage
 * so that shared browsers do not cross-contaminate attribution to the next user.
 */
async function signOutAudit(): Promise<void> {
  clearStoredAcquisition();
  await apiClient.post(USERS.SIGN_OUT);
}

export const usersService = {
  ensureMe,
  signOutAudit,
};
