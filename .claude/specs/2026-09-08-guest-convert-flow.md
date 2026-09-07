# 2026-09-08 — Guest Convert / Edit Flow with Paywall-at-Download

## Product rule (from user, 2026-09-08)

> "All of our features are premium so there is no concept of using any feature freely, but yes at the time of download user must have to pay, either as a guest user or logged-in user."

> "But we don't allow user to download but yes allow to edit any converted file, and you can do any change on backend as well."

Restated:
- **Any user** (guest or signed-in) can **upload + convert + edit** freely.
- **Payment gate** fires **only at Download** (both for guests and signed-in-non-entitled users).
- Guest = zero-friction: no signup at upload, no signup at convert, no signup at edit.
- At Download, guest is prompted to create an account + pay.

## What's already shipped

1. **`8a38bba` — Phase 1**: `openDocumentInEditor` no longer gates on entitlement. Every doc (native or converted) opens freely for every user. Download still gates via `triggerDocumentDownload` → `gateEntitledAction`. Green banner added to `LoginToDownloadModal`.
2. **`b9ee19f` — Phase 2 (reverted `<hash>`)**: swapped `dispatchAuthModal` for `dispatchEmailFirstModal` on guest convert-route uploads. Reverted 2026-09-08 because it forces email at upload; new spec says upload is zero-friction.
3. **Revert commit `<hash>`**: restores `dispatchAuthModal` at guest upload as a fallback until the backend guest-upload endpoint ships. Guest still must sign in at upload today.

## Gap between current state and target

**Currently:** guest drops file on `/convert/word-to-pdf` → auth modal → signs in → file uploads/converts → dashboard placeholder → paywall on Download.

**Target:** guest drops file on `/convert/word-to-pdf` → conversion runs (no auth) → converted file appears (dashboard-like preview OR editor) → user can edit freely → on Download click → email-first modal → signup + `/choose-plan` paywall → download.

## Backend work required

### 1. `POST /documents/upload` — accept anonymous requests

`src/documents/documents.controller.ts:64` currently requires `@User("sub") userId`. Change to:

```typescript
@Post("upload")
@OptionalAuth()          // new decorator OR remove @UseGuards + fall through
@UseInterceptors(FileInterceptor("file"))
async upload(
  @User("sub", { optional: true }) userId: string | null,
  @UploadedFile(DocumentUploadPipe) file: Express.Multer.File,
  @Body("guestSessionId") guestSessionId?: string,
  // ...
) {
  if (!userId && !guestSessionId) {
    // Generate a new guestSessionId, return it in the response so the
    // client can attach it to subsequent requests.
    guestSessionId = crypto.randomUUID();
  }
  const owner = userId ? { userId } : { guestSessionId };
  return this.documentsService.create(owner, file, ...);
}
```

Alternative: use a lightweight session cookie set on first anonymous request. Downside: cookie is less portable across tabs; explicit `guestSessionId` in the client store is more reliable.

### 2. Schema change on `Document` model

Add nullable columns:
- `guestSessionId: string | null` (indexed)
- `expiresAt: DateTime | null` (indexed for cleanup job)

Existing `userId` becomes nullable. Enforce: exactly one of `userId` or `guestSessionId` is non-null.

Migration must backfill existing rows with `userId` unchanged, no `guestSessionId`.

### 3. Guest-doc cleanup cron

New scheduled job — every 6 hours — deletes documents where `guestSessionId IS NOT NULL AND expiresAt < NOW()`. Set `expiresAt` to `NOW() + interval '48 hours'` on guest upload; refresh to `NOW() + interval '48 hours'` on any read/edit action so active users don't lose their file.

### 4. Guest-to-account migration endpoint

```typescript
@Post("migrate-guest")
@ApiOperation({ summary: "Migrate all guest docs to the newly signed-in user" })
async migrateGuest(
  @User("sub") userId: string,
  @Body("guestSessionId") guestSessionId: string,
) {
  // Update documents SET userId = ?, guestSessionId = null, expiresAt = null
  // WHERE guestSessionId = ?
  return this.documentsService.claimGuestDocs(userId, guestSessionId);
}
```

Called by the frontend immediately after `runAutoSignup` succeeds and the Clerk session is active.

### 5. Auth guards on read/download

- `GET /documents/:id` and `GET /documents/:id/download` currently gate on `userId`. Extend to allow `guestSessionId` matches too — a guest can read/download their own docs.
- Download endpoint additionally gates on entitlement (already does — this is where the paywall check lives). For guest → no entitlement → 402 or a redirect that the client interprets as "trigger paywall".

## Frontend work required

### 1. Guest session ID store

New Zustand slice: `guestSessionId: string | null`. Populated on first anonymous upload response, persisted to `localStorage`. Cleared when the user signs in AFTER the migrate-guest call succeeds.

### 2. `POST /documents/upload` client — accept anonymous flow

`lib/client/upload/run-pending-conversion.ts` currently assumes signed-in. Extend the API client to attach `guestSessionId` when Clerk is unauthenticated. On response, if the backend returns a new `guestSessionId`, stash it in the store.

### 3. `upload-workspace.tsx` guest branch

Replace the current auth-modal fallback (revert commit) with the guest-upload path:
```typescript
if (requiresAuth && authLoaded && !isSignedIn) {
  // Guest: fire runPendingConversion directly, no auth prompt.
  // Backend accepts the upload with a fresh guestSessionId.
  const tempId = crypto.randomUUID();
  usePendingConversionsStore.getState().add({ tempId, file: picked, ... });
  void runPendingConversion(tempId, picked, { asGuest: true });
  router.push(ROUTES.APP.DASHBOARD); // OR a guest-preview route
  return;
}
```

### 4. Guest dashboard/preview experience

Two options:
- **A**: Guest sees the same `/dashboard` as signed-in users but only their guest docs (queried by `guestSessionId`). Sidebar hides settings/billing/etc.
- **B**: Guest lands on a lightweight `/preview/[docId]` page that shows just their converted file with Open/Download/Delete buttons.

**Recommend A** — less new UI, dashboard already handles the placeholder-row + convert-complete transition.

### 5. Guest Download flow

`triggerDocumentDownload` currently calls `gateEntitledAction`. For guest docs, extend the gate:
1. If guest and no session → fire `dispatchEmailFirstModal` with a redirect-back-to-download intent.
2. Post-signup, before returning to download: call `POST /documents/migrate-guest` to claim the guest doc for the new account.
3. Then re-check entitlement — new accounts are non-entitled → fire the existing `PaywallModal`.
4. On paywall success → resume the download.

### 6. Migration hook post-signup

`runAutoSignup` in `lib/client/auth/auto-signup.ts` needs a post-success side effect: read `guestSessionId` from the store, POST to `/documents/migrate-guest`, then clear the store.

## Phasing recommendation

Session-sized chunks. Each is testable independently:

| Phase | Scope | Est |
|---|---|---|
| **3A** | Backend: schema change (nullable `userId`, add `guestSessionId`, `expiresAt`), migration | 1 session |
| **3B** | Backend: `@OptionalAuth` on `POST /documents/upload` + guest cleanup cron | 1 session |
| **3C** | Backend: `POST /documents/migrate-guest` + read/download guest access | 1 session |
| **3D** | Frontend: guest session store + `run-pending-conversion` anonymous branch + `upload-workspace` guest path | 1 session |
| **3E** | Frontend: guest download → email-first → auto-signup → migrate → paywall → download | 1 session |
| **3F** | Frontend: guest dashboard filtering / preview page (choice A vs B above) | 0.5 session |
| **3G** | E2E test coverage + Playwright spec for full guest journey | 0.5 session |

Total: ~5-6 sessions of focused work.

## Interim state

Until 3A-3G ship, guests must sign in at upload (current behaviour, restored by the revert commit). This satisfies the "convert + edit for signed-in users is free" part of the rule (already done via Phase 1). The pure "no-signup guest convert" experience is deferred.

## Locked-in decisions (do NOT revisit)

- Paywall trigger = Download only. Never Open, Convert, or Edit. (`gateEntitledAction` should never be called from `openDocumentInEditor`.)
- Green success banner on `LoginToDownloadModal` — matches Flow 2 spec.
- Email-first modal auto-signup lands users at `redirectUrl` (not directly at dashboard) until `/choose-plan` route ships.

## References

- CLAUDE.md § "Auth + paywall + export flow" — items 8-17 all touch this area.
- `.claude/skills/auth-flow-guardian/SKILL.md` — mandatory read before editing any of the 21 files.
- `.claude/skills/pdf-composer-render-fix/SKILL.md` — unrelated, but shows the pattern for skill docs.

## Owner / next step

Next dev session: pick up Phase 3A (backend schema migration). Requires alignment on whether the guest-session model uses (a) explicit `guestSessionId` string in requests, (b) HTTP-only cookie, or (c) a synthesized "guest user" record. Recommend (a) for simplicity + portability.
