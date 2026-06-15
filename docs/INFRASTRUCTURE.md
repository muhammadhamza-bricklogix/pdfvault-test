# PDFedits — Infrastructure & System Overview

**Audience:** Project / product managers and non-engineering stakeholders.
**Purpose:** Explain what the system is made of, how the pieces fit together, and what it depends on — without diving into code-level detail.
**Last updated:** 2026-06-15

---

## 1. Executive summary

**PDFedits** is a cloud-based PDF tools platform. Users sign in, upload (or import from cloud storage) a PDF, edit it in a full in-browser editor, run PDF utilities (compress, password-protect, convert, etc.), and save their work back to the cloud where it stays in a personal document library.

The product is delivered as a **web application** that runs in the user's browser (desktop and mobile). It talks to a **backend service** that does the heavy lifting — storing files, processing PDFs, and keeping each user's document library. Identity and login are handled by a dedicated **authentication provider**.

In short, three independent building blocks work together:

1. **The web app** (what the user sees and interacts with).
2. **Authentication** (who the user is / secure login).
3. **The backend + storage** (where files live and where processing happens).

---

## 2. System at a glance

```
                         ┌─────────────────────────────┐
                         │        USER'S BROWSER        │
                         │   (desktop & mobile web)     │
                         │  ┌───────────────────────┐   │
                         │  │   PDFedits Web App     │   │
                         │  │  - Marketing pages     │   │
                         │  │  - Dashboard / library │   │
                         │  │  - PDF Editor          │   │
                         │  │  - PDF tools           │   │
                         │  │  - Public share viewer │   │
                         │  └───────────────────────┘   │
                         └───────┬───────────┬──────────┘
                                 │           │
              secure login       │           │   file import
              & user identity    │           │   (optional)
                                 ▼           ▼
                  ┌────────────────────┐  ┌──────────────────────────┐
                  │  Authentication    │  │   Cloud drives            │
                  │  provider (Clerk)  │  │   (Google Drive,          │
                  └────────────────────┘  │    Microsoft OneDrive)    │
                                 │         └──────────────────────────┘
              authenticated      │
              API requests       ▼
                  ┌──────────────────────────────────────────────┐
                  │            BACKEND SERVICE (API)              │
                  │  - Document library (list/rename/delete)      │
                  │  - PDF processing (compress, encrypt, etc.)   │
                  │  - File conversion                            │
                  │  - Activity / audit log                       │
                  └───────────────┬──────────────────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────────────────┐
                  │     CLOUD FILE STORAGE (object storage)       │
                  │  Stores the actual PDF files; served back to  │
                  │  the browser via short-lived secure links.    │
                  └──────────────────────────────────────────────┘
```

**How to read this:** the browser app is the front door. For anything that needs to be saved or processed, it makes secure, authenticated requests to the backend. The backend keeps the files in cloud storage and hands them back to the browser through temporary, secure download links.

---

## 3. The three pillars

### A. The web application (front end)
This is the part the team in this repository builds and maintains. It renders every screen, runs the interactive PDF editor entirely in the browser, and coordinates all communication with the other services. It is responsible for the user experience, not for permanently storing data.

### B. Authentication
Login, sign-up, password handling, and user identity are delegated to **Clerk**, a specialist authentication provider. This means we don't store passwords ourselves; Clerk issues a secure, time-limited token after login, and the app attaches that token to every request so the backend knows who is asking.

### C. Backend service + storage
A **separate backend API** (maintained outside this repository) is the system of record. It stores each user's documents, performs server-side PDF processing and file conversion, and keeps an activity/audit trail. The PDF files themselves live in **cloud object storage** and are delivered to the browser through short-lived secure links.

---

## 4. Technology stack (plain-language)

These are the main technologies the web application is built on. Each line says what it is and why it's used — no code detail required.

| Area | Technology | What it does for us |
|---|---|---|
| Core framework | **Next.js 16** (with React 19) | The foundation for building the web pages and app screens. |
| Language | **TypeScript** | A safer version of JavaScript that catches mistakes before release. |
| Runtime & package manager | **Bun** | Runs and builds the app; manages the software libraries it depends on. |
| Visual styling | **Tailwind CSS** + **HeroUI** component library | Consistent, modern look-and-feel and ready-made UI controls. |
| Authentication | **Clerk** | Secure login, sign-up, and user identity. |
| Data fetching & caching | **TanStack Query** | Efficiently loads and caches information from the backend. |
| In-app state | **Zustand** | Keeps track of what the user is doing inside the editor. |
| PDF viewing | **pdf.js** | Renders PDF pages on screen in the browser. |
| PDF editing canvas | **Fabric.js** | Powers the interactive layer for text, shapes, drawings, and images. |
| PDF writing/export | **pdf-lib** (+ font tooling) | Builds the final edited PDF when the user saves or exports. |
| Forms & validation | **React Hook Form** + **Zod** | Collects and validates user input (e.g., sign-up forms). |
| File handling | **dnd-kit**, drag-and-drop, file pickers | Uploading, reordering pages, and importing files. |
| Quality tooling | **ESLint**, **Prettier**, **Playwright** | Code consistency, formatting, and automated browser testing. |

**Key takeaway:** the editor is unusually capable because three PDF technologies work together in the browser — one to *display* PDFs, one to provide the interactive *editing* layer, and one to *write* the final file. This is what allows full editing without sending the file back and forth for every change.

---

## 5. Application map (what users can reach)

The product is organized into a few clear areas:

| Area | Purpose |
|---|---|
| **Marketing / public site** | Home page, pricing, and legal pages (privacy, terms, cookies, refund, contact). The "front of house." |
| **Authentication** | Sign-in, sign-up, and single-sign-on callback screens. |
| **Dashboard** | The signed-in user's home base: their document library, activity history, and account settings. |
| **PDF Editor** | The flagship feature — a full editor for an opened document. |
| **PDF Tools** | Conversion and utility tools (e.g., Word↔PDF, Excel↔PDF) and processing actions (compress, encrypt/decrypt, flatten, extract images). |
| **Public share viewer** | A no-login page (`/share/<token>`) that anyone with the link can open to view a PDF the owner shared. Optional password gate. |

---

## 6. Core capabilities

**Document management**
- Upload PDFs (or other documents that are converted to PDF first).
- Import directly from **Google Drive** and **Microsoft OneDrive**.
- A personal library to list, open, rename, delete, and bulk-delete documents.
- An activity / audit history of actions taken.
- Duplicate-name detection with an "overwrite or keep both" choice on upload.

**PDF editor** (runs in the browser)
- Edit text directly on the page.
- Add drawings, shapes, highlights, images, and signatures.
- Whiteout / redact content.
- Watermarks and background images.
- **Manage Pages**: reorder, rotate, duplicate, delete, resize, recolor, and import pages from other PDFs.
- Save back to the cloud, or export/download a finished file.

**PDF utilities & conversion** (run on the backend)
- Compress, password-protect (encrypt) / unlock (decrypt), flatten form fields, extract images.
- Convert between PDF and Office formats (Word, Excel, PowerPoint) and images.

**Public share links** (added 2026-06-15 — see `SHARE_LINKS_BACKEND_CONTRACT.md`)
- A signed-in user can generate a public URL for the PDF they have open. They pick an expiry (1 hour to 30 days) and may optionally set a password. The URL can be opened by anyone — no sign-up, no PDFedits account required.
- Recipients land on a clean read-only viewer with a built-in page navigator. If a password is set they're prompted for it before the file loads.
- The owner can revoke a share at any time; revoked links return an "unavailable" page on the next access.
- **Where this work lives today:** the entire user-facing flow ships from the web app's own server (Next.js route handlers under `/api/share/*`). State (signed tokens, password hashes, deny-list, bytes) currently lives **in-memory inside the web-app server process** — fine for a single-instance demo, but it resets on every deploy and doesn't survive horizontal scaling. The backend handoff is documented separately in [`SHARE_LINKS_BACKEND_CONTRACT.md`](./SHARE_LINKS_BACKEND_CONTRACT.md); once the backend implements the contract, the four stores swap from in-memory to persistent without any UX change.

---

## 7. How a document flows through the system

A simple end-to-end picture of the most common journey:

1. **Sign in.** The user logs in; the authentication provider issues a secure token.
2. **Bring in a file.** The user uploads a PDF or imports one from Google Drive / OneDrive. Non-PDF files are converted to PDF first. Upload progress is shown live.
3. **Store it.** The backend saves the file to cloud storage and adds it to the user's library.
4. **Open & edit.** The app downloads the file (via a short-lived secure link) and opens it in the editor. All editing happens live in the browser.
5. **Save.** When the user saves, the app produces the edited PDF and sends it back to the backend, which updates the stored copy and the library.
6. **Reuse or download.** The user can re-open it later, run utilities on it, or download a copy.

**Why this matters for planning:** editing is fast and private because it happens in the browser, while storage and processing stay server-side so files are safe and available across devices.

---

## 8. External services & integrations

The product depends on a handful of outside services. These are worth tracking because they affect cost, accounts/keys, and uptime.

| Service | Role | Notes for planning |
|---|---|---|
| **Clerk** | User authentication & identity | Requires an account and configuration keys. Login availability depends on this service. |
| **Backend API** | Storage, processing, library, audit | Maintained separately from this web app. The app connects to it via a configured address. |
| **Cloud object storage** | Holds the actual PDF files | Files are served to users through short-lived secure links (valid for a short window, then expire). |
| **Google Drive** | Optional file import | Requires Google API credentials. |
| **Microsoft OneDrive** | Optional file import | Requires Microsoft credentials. |

---

## 9. Environments & configuration

The app is configured through a small set of environment settings (no secrets are stored in the code). At a high level, these settings tell the app:

- **Where the backend lives** (the API address it should talk to).
- **How to connect to Google Drive** (Google credentials, for the optional import feature).
- **How to connect to Microsoft OneDrive** (Microsoft credentials, for the optional import feature).
- **Which mode it's running in** (development vs. production).
- **Public share signing secret** (`SHARE_SECRET`) — a long random string used to sign share-link tokens. Rotating it instantly invalidates every existing share link, so it should be set once per environment and only changed during a coordinated rotation. Generate with `openssl rand -base64 48`.
- **Public app URL** (`NEXT_PUBLIC_APP_URL`) — the canonical address used when generating shareable links shown to users (e.g., `https://app.pdfedits.com`). If unset the app falls back to the request's host header.

Typically there are separate configurations for **local development**, a **staging/test** environment, and **production**, each pointing at its own backend and credentials.

---

## 10. Build, run & deployment

- **Local development:** engineers run the app on their machine with a single command; it rebuilds instantly as they make changes.
- **Production build:** the app is compiled into an optimized package for release.
- **Hosting:** it's a standard modern web app and can be hosted on common Next.js-friendly platforms (e.g., a managed platform like Vercel, or a container on the team's own cloud). The backend and storage are deployed and scaled independently of the web app.
- **Runtime/tooling versions are pinned** (Bun and Next.js versions are fixed), so every environment builds the same way.

---

## 11. Security & privacy

- **No passwords stored by us** — identity is handled by Clerk.
- **Every backend request is authenticated** with a secure, time-limited token; if a token expires mid-session the app quietly refreshes it.
- **Protected areas require login** — unauthenticated users can't reach the dashboard or a user's documents.
- **Files are delivered via short-lived secure links** that expire automatically, rather than permanent public URLs.
- **Public share links** are stateless HMAC-signed tokens (not JWTs — no algorithm-negotiation surface). Expiry is enforced server-side; optional passwords are bcrypt-hashed and the hash never leaves the server (it's not embedded in the URL); revocation is instant via a server-side deny-list; bytes are gated behind a separate short-lived HttpOnly cookie scoped to a single share. Share viewer pages are marked `noindex`, `no-store`, and `Referrer-Policy: no-referrer`.
- **Compliance surface exists** — privacy policy, terms, cookies, "do not sell," and refund pages are part of the product.

---

## 12. Performance & cross-device support

- The app is built to work on **both desktop and mobile browsers**, with special attention to mobile Safari (iPhone/iPad), which historically is the most fragile environment for in-browser PDF rendering.
- Mobile and desktop intentionally behave slightly differently in places to stay reliable on older mobile browsers (for example, how text is rendered).
- Large/heavy actions (uploads, saves, processing) show clear progress and loading indicators so the app never feels frozen.

---

## 13. Quality & maintainability

- **Typed codebase** (TypeScript) reduces a whole class of bugs before release.
- **Automated code checks** (linting/formatting) enforce consistency.
- **Automated browser tests** (Playwright) are available for end-to-end checks.
- **A documented "known issues & decisions" log** is kept for the most delicate part of the system (the PDF editor), so past fixes aren't accidentally undone.
- **A pre-computed codebase map** (repocards) helps engineers and tools navigate the project quickly.

---

## 14. Notes & dependencies for planning

- **The backend is a separate system.** This document describes the web app; timelines for features that need new server capabilities depend on the backend team as well.
- **Third-party accounts are required** for authentication (Clerk) and cloud import (Google, Microsoft). Provisioning and key management for these should be tracked.
- **Mobile (especially iOS Safari) is the #1 area to regression-test** before any release that touches the PDF editor.
- **Storage and processing costs scale with usage** (number/size of documents and processing actions), and live on the backend/storage side rather than the web app.
- **Public share links are demo-grade until the backend takes over storage.** The current implementation keeps share metadata and PDF bytes in the web-app server's memory. That means: (a) every deploy / restart wipes existing share URLs, (b) a multi-instance / autoscaling deployment will see each instance serving different shares, and (c) total share traffic is bounded by the web-app server's RAM. The contract for the backend to take over the four stores is documented in [`SHARE_LINKS_BACKEND_CONTRACT.md`](./SHARE_LINKS_BACKEND_CONTRACT.md). Until that lands, run shares on a single web-app instance with predictable restarts.

---

## 15. Glossary (plain definitions)

| Term | Plain meaning |
|---|---|
| **Front end / web app** | The part that runs in the browser and that users see and click. |
| **Backend / API** | The behind-the-scenes service that stores files and does processing. |
| **Object storage** | Cloud file storage where the actual PDFs are kept. |
| **Authentication** | Verifying who a user is (login). |
| **Token** | A temporary digital "pass" that proves a logged-in user's identity on each request. |
| **Signed / secure link** | A temporary web address to download a file that expires after a short time. |
| **Render** | To draw/display a PDF page on screen. |
| **Environment (dev/staging/prod)** | Separate copies of the system for building, testing, and live use. |
| **Single sign-on (SSO)** | Logging in using an existing account (e.g., Google). |
| **Audit log** | A record of actions taken, for history and accountability. |

---

*Prepared from the current state of the `pdfedits-frontend` web application. For deeper technical detail, engineering can supply architecture diagrams and the internal developer documentation.*
