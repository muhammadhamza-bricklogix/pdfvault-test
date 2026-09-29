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
 */
async function ensureMe(): Promise<void> {
  await apiClient.post(USERS.ME);
}

/**
 * Records a sign-out event in the backend audit log. The Clerk session is
 * still destroyed by `useClerk().signOut()` — this just persists the "who
 * logged out, when, from where" trail for support / abuse triage.
 *
 * Errors are intentionally swallowed by the caller — failing to write an
 * audit row should never block a sign-out. If the backend is down, the user
 * still signs out client-side and the log entry is the cost.
 */
async function signOutAudit(): Promise<void> {
  await apiClient.post(USERS.SIGN_OUT);
}

export const usersService = {
  ensureMe,
  signOutAudit,
};
