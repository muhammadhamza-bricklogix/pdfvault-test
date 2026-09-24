---
name: analytics-check
description: MANDATORY load whenever the user reports analytics or tracking problems — phrases like "Google Analytics isn't tracking", "GA isn't working", "no US visitors in GA", "GA4 shows zero", "GTM broken", "Clarity not recording", "tracking is broken", "analytics missing", "my events aren't showing", "conversion tracking dead", "Ads not tracking", "CookieYes blocking", or any variant of "why don't I see visitors in <analytics tool>". Also fires when the user pastes a Google Ads / GA4 / GTM / Clarity dashboard screenshot with no data. This project wires GA4 + Google Ads + GTM + Microsoft Clarity + CookieYes in `app/layout.tsx`, and every reported analytics bug so far has been one of a small set of causes — consent gating, missing tag ID, ad-blocker, or GA property never actually created. This skill codifies the sweep so you don't re-investigate from scratch each time.
---

# Analytics check

The site has five analytics / consent surfaces wired into `app/layout.tsx`:

| Surface | ID / handle | Location |
|---|---|---|
| GA4 | `G-K6PVB4B39T` (verify with user — historically a placeholder) | `<Script>` after preconnects |
| Google Ads | `AW-18226423046` | Same gtag call as GA4 |
| Google Tag Manager | `GTM-5R5LRTTD` | Raw `<script>` in `<head>`, tagged `cookieyes-necessary` |
| Microsoft Clarity | `ych70e11tb` | Raw `<script>` in `<head>`, tagged `cookieyes-necessary` |
| CookieYes | container `98d78886fe30030f1080cdeb0a6c0a25` | `<script async>` before GTM |

Every "analytics broken" report so far has been in this bucket:
1. GA4 property doesn't actually exist (placeholder ID)
2. CookieYes gating blocks Google tags until consent
3. No Consent Mode v2 defaults set
4. Ad blocker in a specific region
5. GA4 internal-traffic filter misconfigured with a wide US IP range
6. GTM container has no GA4 configuration tag inside it

Your job when this skill fires: run the diagnostic sweep in order, identify which of the six causes matches, propose a fix, wait for approval.

## When this skill applies

- Direct: "GA isn't tracking", "analytics broken", "no visitors in GA4"
- Regional: "US visitors not showing", "EU users missing", "traffic gap by country"
- Downstream: "Ads conversions not firing", "Clarity has no sessions", "GTM Preview mode disconnects"
- Consent-adjacent: "CookieYes blocks tracking", "banner won't accept", "GCM misconfigured"

If the user is asking about SETTING UP analytics (not fixing broken analytics), this skill still helps — start from Step 1 to verify what's currently wired and what's missing.

## Step 1 — Read the layout

Always start here. Do not investigate from memory:

```
Read app/layout.tsx (lines 240-345 approximately — the analytics block)
```

Confirm the five surfaces are still wired the way this skill describes. If the layout has changed since 2026-09-22, re-orient and update this skill afterwards.

Note especially:
- Which `<Script>` tags carry `data-cookieyes="..."` and which don't
- Which analytics IDs are hardcoded vs env-var driven
- Whether Consent Mode v2 defaults are set BEFORE `gtag('config', ...)`

## Step 2 — Confirm which surface is broken

Ask the user (or infer from the report) exactly which pipeline they think is broken:

| Surface reported broken | What to check first |
|---|---|
| GA4 | Step 3 (GA4-specific) |
| Google Ads | Step 3 + Step 5 (conversion tag mount) |
| GTM | Step 4 (container config) |
| Microsoft Clarity | Step 6 (Clarity script + Consent API) |
| "Everything" / vague | Step 3, 4, 6 in parallel |

## Step 3 — GA4 diagnostic

### 3a. Verify the property exists

Ask the user directly if unsure: *"Is `G-K6PVB4B39T` a real GA4 property you own? Please open GA Admin → Data Streams and confirm the Measurement ID matches."* Do not assume.

If placeholder → the fix is to swap in the real ID. Nothing else matters until this is resolved.

### 3b. Verify tags are firing

Have the user open the site in an Incognito window, then:

- DevTools → Network → filter `google-analytics.com` or `googletagmanager.com`
- Expect a request to `googletagmanager.com/gtag/js?id=G-...` with 200 status
- Expect a `POST` to `google-analytics.com/g/collect?...` on page load

If `gtag/js` request is missing → CookieYes is blocking. Go to Step 7 (Consent).
If `gtag/js` loads but `/g/collect` is missing → GA config isn't running. Check console for `dataLayer` errors.
If `/g/collect` fires and returns 200 → tag is working; problem is downstream (property mismatch, filter, region).

### 3c. Check GA4 Realtime

Have the user open GA4 → Reports → Realtime. If Incognito visit shows in Realtime → property is correctly wired; the "no data" report is a filter / region / report-time issue.

If Realtime is empty → the property isn't receiving hits. Return to 3a.

### 3d. Check GA4 filters

GA4 Admin → Data Settings → Data Filters. Look for:
- "Internal Traffic" filter with a state = "Active"
- IP range in that filter that's wider than intended (a `/16` covers ~65k IPs; a `/8` covers 16M IPs — either can swallow entire cities or ISPs)

If active → propose toggling to "Testing" state to unmask the affected traffic.

### 3e. Check Reporting Identity

GA4 Admin → Reporting Identity. If set to "Device-based", iOS Safari ITP wipes `_ga` every 7 days → chronic under-count. Recommend "Blended" for US-heavy traffic.

## Step 4 — GTM diagnostic

### 4a. Verify container fires

Install [Google Tag Assistant Chrome extension] and enable Debug mode. Navigate to the site. Expect: `GTM-5R5LRTTD` detected, container fires on page_view.

If container doesn't fire → check the raw `<script>` in `<head>` still exists (not next/script wrapper). Look for it verbatim in the HTML source (View Page Source).

### 4b. Verify GA4 config tag inside GTM

GTM dashboard → Container → Tags. There should be a **Google Tag** (or legacy "GA4 Configuration") tag pointing at the same Measurement ID as the direct loader in `layout.tsx`.

If missing → propose adding it. GTM firing without a GA4 config inside it = no GA4 data.

### 4c. Verify triggers

GTM dashboard → Container → Triggers. The GA4 config tag should fire on "All Pages" or "Initialization — All Pages". If gated on a custom event that never fires, GA4 won't collect.

## Step 5 — Google Ads conversions

For the paywall-success conversion (`AW-18226423046/31lDCOKzxeccEIbKhPND`) or signup conversion (`AW-18226423046/_l8jCOv0yuccEIbKhPND`):

- Confirm `GtagConversion` component mounts at the right lifecycle point (search `components/shared/gtag-conversion.tsx`)
- In DevTools Network, filter `googleadservices.com` on the trigger event (paywall success or signup)
- Expect a `POST` to `google.com/pagead/conversion/...`

If tags don't fire on the conversion event → check that `send_to` prop is a valid conversion label (matches Ads dashboard).

## Step 6 — Microsoft Clarity

Clarity's setup checker is at clarity.microsoft.com → Project Settings → Setup. Enter site URL, it inspects the raw HTML.

Common Clarity failure: script wrapped by CookieYes autoblocker. Check `app/layout.tsx` — the Clarity `<script>` should carry `data-cookieyes="cookieyes-necessary"` (or matching category). If missing, add it.

The CookieYes dashboard has a **Microsoft Clarity Consent API** toggle (shown ON in the 2026-09-22 screenshots) — that tells CookieYes to forward consent state directly to Clarity. Confirm it's still ON.

## Step 7 — CookieYes / Consent diagnostic

The CookieYes dashboard's Advanced Settings page controls whether tags are gated. Ask the user to check:

| Setting | If OFF | If ON |
|---|---|---|
| Banner display status | banner hidden, tags fire freely | banner shown, tags gated by consent |
| Support GCM | tags fire regardless of consent → GDPR risk | Consent Mode v2 wired end-to-end |
| Allow Google tags to fire before consent | Google tags gated by consent | Google tags fire immediately (US-friendly, EU-risky) |

**Diagnostic combinations:**

- Banner ON + Support GCM OFF + Fire-before-consent OFF → tags gated. US visitors who dismiss the banner never track. This matches the pdfvault.ai screenshots from 2026-09-22.
- Banner OFF → CookieYes is disabled; tags should fire freely. If GA still empty, cause is elsewhere.
- Banner ON + Fire-before-consent ON → tags fire but consent isn't recorded. Compliant only in non-EEA regions.

**Fixes:**
- **US-only compliance:** toggle Fire-before-consent ON. Tags fire for everyone.
- **EU-compliant:** toggle Support GCM ON + wire Consent Mode v2 defaults in `layout.tsx` (see below).
- **Debug-only:** disable the banner temporarily to prove tags work.

## Step 8 — Consent Mode v2 defaults (code change)

If the fix is "wire Consent Mode v2 properly", the change to `app/layout.tsx` is:

```tsx
<Script id="gtag-init" strategy="afterInteractive">
{`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
// Consent Mode v2 defaults BEFORE gtag('config').
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted',
  wait_for_update: 500,
});
gtag('js', new Date());
gtag('config', 'G-K6PVB4B39T');
gtag('config', 'AW-18226423046');`}
</Script>
```

Then wire CookieYes' `cookieyes_consent_update` event handler to call `gtag('consent', 'update', {...})` with the user's actual choices. That handler goes in a small client component mounted from `AppProviders`, since it needs access to `window` and runs after CookieYes fires.

**Important:** Setting `analytics_storage: 'granted'` by default is legally grey in the EEA. For strict compliance, gate the default on CookieYes' geo API and only auto-grant for non-EEA IPs. For US-only compliance, granted-by-default is fine.

## Step 9 — Report shape

```
Analytics triage — <surface>

Symptom: <what user reported>

Wiring check (app/layout.tsx): <ok | broken>
  - GA4 ID: G-K6PVB4B39T <verified real | unverified — need user to confirm>
  - Ads ID: AW-18226423046 <ok>
  - GTM ID: GTM-5R5LRTTD <ok>
  - Clarity: <ok>
  - CookieYes autoblocker: <ON — gates tags | OFF — tags fire freely>

Evidence:
  - Network requests: <observed>
  - Realtime: <observed>
  - CookieYes dashboard: <observed from screenshots>

Root cause: <one of the six known causes, named>

Proposed fix: <specific action, dashboard or code>

Compliance impact: <US-only fine | EEA risk if X>

Need from you: <the specific piece of info required, or green light to ship>
```

## Common failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| GA4 has zero data anywhere | Property never created; ID is a placeholder | Create GA4 property, swap ID |
| US visitors missing, EU present | GA4 Internal-Traffic filter with wide US IP range | Toggle filter to Testing |
| All regions reduced but not zero | Ad blockers + CookieYes autoblocker | Fire-before-consent ON, or GCM |
| Realtime empty but property exists | CookieYes autoblocker wraps `<Script>` | Add `data-cookieyes="cookieyes-necessary"` |
| Ads conversions never fire | Wrong `send_to` label | Verify label against Ads dashboard |
| Clarity setup check fails | Script wrapped by autoblocker | Add cookieyes tag OR enable Clarity Consent API |
| GTM Preview mode won't connect | GTM script serialized as next/script | Keep raw `<script>` in `<head>` (already done — do not "clean up") |

## What NOT to do

- Do NOT tag `<Script>` `data-cookieyes="cookieyes-necessary"` blindly without confirming the user's compliance stance. It's a compliance decision, not a technical one.
- Do NOT swap the GA4 ID without user confirmation of the correct value.
- Do NOT disable CookieYes to "make it work" without the user understanding the compliance trade-off.
- Do NOT change GTM raw `<script>` to `next/script` — the raw form is required for Tag Assistant + Preview mode detection (documented in `app/layout.tsx` comments line 259-286).
- Do NOT recommend server-side GTM without knowing whether the user has infrastructure for it.

## Cross-references

- `problem-triage` — parent flow; this skill executes Phase 2 for analytics surfaces
- `auth-flow-guardian` — do NOT edit `app/layout.tsx` blindly; the `ClerkProvider` structure is load-bearing
- `regression-forensics` — if the analytics broke after a specific change, load this too
- `chrome-devtools-mcp:cookie-debugging` — for hands-on browser-side inspection of tag firing
