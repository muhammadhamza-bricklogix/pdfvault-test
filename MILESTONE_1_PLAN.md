# Milestone 1 — Weeks 1-2: Core Viewer + Basic Editing + UI Foundation

> **Tracking document.** Covers what's done, what's in progress, and what remains.  
> Updated as work progresses. Each task has a status: DONE / IN PROGRESS / TODO.

---

## Summary

**Goal:** Establish the complete frontend UI foundation — landing page, navbar, auth, PDF editor with core tools, property panel, editor menu, and performance panel.

**Timeline:** Weeks 1-2  
**Scope:** Frontend only (no backend API routes in this milestone)

---

## Overall Progress

| Area | Status | Notes |
|---|---|---|
| Landing page (hero) | DONE | Hero section with file upload + star rating |
| Landing page (feature cards) | TODO | Two sections: PDF Editor Tools (10 cards) + Conversions (5 cards) |
| Landing page (footer) | TODO | Multi-column footer (Product, Company, Legal) |
| Navbar (HeroUI rework) | TODO | Replace custom navbar with HeroUI Navbar + hamburger for mobile |
| Auth (sign-in/sign-up) | DONE | Clerk integration, email+OTP, Google OAuth |
| My Account drawer | TODO | Custom drawer: profile info, My PDFs link, Sign Out |
| PDF Viewer + zoom | DONE | pdf.js rendering, zoom controls, page navigation |
| Thumbnail sidebar | DONE | Left sidebar, lazy-loaded, click to navigate |
| Undo/Redo | DONE | Per-page history stack + keyboard shortcuts + toolbar buttons |
| Text editing + floating toolbar | DONE | IText creation, font/size/bold/italic/underline/color |
| Drawing & shapes | DONE | Freehand brush, rect, ellipse, line, arrow |
| Highlight & whiteout | DONE | 4 color presets, whiteout rectangles |
| Eraser (click-to-delete) | DONE | Deletes Fabric.js objects on click |
| Signature modal | DONE | Draw/type/upload tabs |
| Image insertion | DONE | File picker, auto-scale, center placement |
| Editor hamburger menu | TODO | My PDFs, New, Open (working), Save/Export (disabled + coming soon) |
| Right sidebar (properties) | TODO | Fill, stroke, opacity, position (X/Y), size (W/H) |
| Performance panel | TODO | Memory %, file size, page objects, rotation, FPS |

---

## Task Breakdown

### 1. Landing Page — Feature Cards

**Status:** TODO

Two sections below the existing hero:

**Section A — PDF Editor Tools (10 cards)**

| # | Title | Description |
|---|---|---|
| 1 | Smart PDF Viewer | Lightning-fast viewer with zoom, undo/redo, performance panel — even for large files |
| 2 | Text & Object Editor | Edit text directly on PDF with floating toolbar (fonts, colors, formatting) |
| 3 | Drawing & Annotation Suite | Shapes, freehand brush, eraser, pressure sensitivity, images & more |
| 4 | Digital Signatures | Draw, upload or type signatures and place them anywhere |
| 5 | Interactive Forms | Turn PDFs into fillable forms (text fields, checkboxes, dropdowns, etc.) |
| 6 | Layers Panel | Full control: show/hide, lock, delete, reorder layers |
| 7 | Page Manager | Reorder pages (drag thumbnails), split, rotate, resize, add/remove blank pages |
| 8 | Page Enhancements | Add page numbers, watermarks, custom backgrounds |
| 9 | Find & Replace | Search and replace text across the entire document |
| 10 | Redact & Flatten | Permanently hide sensitive info and lock form fields |

**Section B — PDF Conversion Features (5 cards)**

| # | Title | Description |
|---|---|---|
| 1 | Office Conversions | High-fidelity PDF to/from Word, Excel, PowerPoint |
| 2 | Multi-Format Export | Export as PDF, JPG, PNG, Word, Excel, PowerPoint |
| 3 | Image Extractor | Extract all images from PDF in one click (as ZIP) |
| 4 | Smart Compression | Reduce file size with High / Balanced / Light / Custom quality options |
| 5 | Password Protection | 128-bit or 256-bit encryption — easy protect/unprotect |

**Implementation:**
- Each card: icon + title + short description
- Grid layout (responsive: 1 col mobile, 2 col tablet, 3-4 col desktop)
- Cards are presentational for now (no navigation to non-existent tools)
- Use HeroUI `Card` component

**Files to create/modify:**
- `components/sections/home/feature-cards.tsx` — PDF Editor Tools grid
- `components/sections/home/conversion-cards.tsx` — Conversion Features grid
- `app/page.tsx` — add both sections below hero

---

### 2. Landing Page — Multi-Column Footer

**Status:** TODO

**Columns:**
- **Product:** PDF Editor, Compress PDF, Convert PDF, Protect PDF (links to tools, most disabled for now)
- **Company:** About, Contact, Blog (placeholder links or anchors)
- **Legal:** Privacy Policy, Terms of Service (placeholder links)
- **Bottom row:** Logo + copyright + social links

**Implementation:**
- Use HeroUI components or plain Tailwind layout
- Responsive: columns stack on mobile

**Files to create/modify:**
- `components/shared/footer/site-footer.tsx`
- `app/layout.tsx` — add footer to root layout

---

### 3. Navbar — HeroUI Rework

**Status:** TODO

**What changes:**
- Replace current custom navbar (`components/shared/navigation/site-navbar.tsx`) with HeroUI `Navbar` component
- Built-in hamburger menu for mobile responsiveness (HeroUI handles this)
- Update nav links to match real tools: **PDF Editor**, **Conversions**, **Compress**, **Protect**
- Keep: logo, theme toggle, auth buttons (Sign in / Create account / UserButton)

**Key decisions:**
- Use HeroUI `Navbar`, `NavbarBrand`, `NavbarContent`, `NavbarItem`, `NavbarMenuToggle`, `NavbarMenu`, `NavbarMenuItem`
- Mobile menu items match desktop nav links

**Files to modify:**
- `components/shared/navigation/site-navbar.tsx` — full rework

---

### 4. My Account Drawer (Custom)

**Status:** TODO

**Sections:**
- Profile info (avatar, name, email — from Clerk `useUser()`)
- My PDFs link (disabled for now, no backend)
- Sign Out button

**Implementation:**
- HeroUI `Drawer` component, triggered from navbar (replaces Clerk `UserButton` or sits alongside it)
- Clerk `useClerk().signOut()` for sign out
- Keep it minimal, expand in future milestones

**Files to create/modify:**
- `components/shared/navigation/my-account-drawer.tsx`
- `components/shared/navigation/site-navbar.tsx` — add trigger button

---

### 5. Editor Hamburger Menu

**Status:** TODO

**Menu items:**
| Item | Status | Action |
|---|---|---|
| Create New | Working | Clears editor, resets store, shows upload screen |
| Open File | Working | Opens file picker, loads new PDF |
| Save | Disabled | Tooltip: "Coming Soon" |
| Export | Disabled | Tooltip: "Coming Soon" |
| My PDFs | Disabled | Tooltip: "Coming Soon" |

**Implementation:**
- HeroUI `Dropdown` or `Popover` triggered from a hamburger icon in EditorTopBar
- Working items dispatch store actions
- Disabled items show tooltip on hover

**Files to create/modify:**
- `components/sections/pdf-editor/HamburgerMenu.tsx`
- `components/sections/pdf-editor/EditorTopBar.tsx` — add hamburger trigger

---

### 6. Right Sidebar — Property Panel

**Status:** TODO

**Layout:** Fixed panel on the right side of the editor (alongside existing left thumbnail sidebar).

```
┌──────────┬───────────────────────────┬──────────┐
│ Thumbs   │  EditorTopBar             │ Props    │
│ (left)   │─────────────────────────  │ Panel    │
│ ┌──────┐ │                           │──────────│
│ │ Pg 1 │ │                           │ Fill: #  │
│ ├──────┤ │   PDF Canvas              │ Stroke:  │
│ │ Pg 2 │ │                           │ Opacity: │
│ ├──────┤ │                           │ X: Y:    │
│ │ Pg 3 │ │                           │ W: H:    │
│ └──────┘ │                           │          │
└──────────┴───────────────────────────┴──────────┘
```

**Properties (when object selected):**
- **Fill:** color picker for background fill
- **Stroke:** color picker + width input
- **Opacity:** slider (0–100%)
- **Position:** X, Y numeric inputs
- **Size:** W, H numeric inputs

**When nothing selected:** Show a hint message ("Select an object to edit its properties")

**Implementation:**
- Listen to Fabric.js `selection:created`, `selection:updated`, `selection:cleared` events
- Read properties from active object, update on change
- Two-way binding: sidebar changes update object, object changes update sidebar

**Files to create/modify:**
- `components/sections/pdf-editor/RightSidebar.tsx`
- `components/sections/pdf-editor/PdfEditorShell.tsx` — add right sidebar to layout

---

### 7. Performance Panel

**Status:** TODO

**Displays (based on reference screenshot):**
- Memory usage bar + percentage + MB value (via `performance.memory` API where available)
- File size (from loaded PDF file)
- Page Objects count (Fabric.js objects on current page)
- Rotation (current page rotation, 0° default)
- FPS counter (requestAnimationFrame-based)

**Implementation:**
- Small floating panel, toggleable from toolbar or info bar
- Updates on interval (FPS) and on canvas changes (object count)
- Compact card-style UI matching the screenshot

**Files to create/modify:**
- `components/sections/pdf-editor/PerformancePanel.tsx`
- `components/sections/pdf-editor/EditorTopBar.tsx` — add toggle button

---

## Execution Order (Recommended)

Work in this order to minimize conflicts and build dependencies first:

| Step | Task | Depends on |
|---|---|---|
| 1 | Navbar HeroUI rework | Nothing (standalone) |
| 2 | Multi-column footer | Nothing (standalone) |
| 3 | Feature cards (both sections) | Nothing (standalone) |
| 4 | My Account drawer | Navbar rework (trigger lives in navbar) |
| 5 | Right sidebar (property panel) | Nothing (editor standalone) |
| 6 | Editor hamburger menu | Nothing (editor standalone) |
| 7 | Performance panel | Nothing (editor standalone) |

Steps 1-3 can be done in parallel (landing page work).  
Steps 5-7 can be done in parallel (editor work).  
Step 4 depends on step 1.

---

## Out of Scope (This Milestone)

These items are explicitly NOT part of this milestone:

- Backend API routes (Save, Export, Compress, etc.)
- Edit existing PDF text (Phase 2B — overlay approach)
- Page management (drag-reorder, rotate, split) — Phase 7
- Find & Replace — Phase 9
- Form mode — Phase 10
- Layers panel — deferred to future milestone
- Freemium gating — Phase 14
- Any PDF conversion features (backend required)

---

## Tech Notes

- **HeroUI Navbar:** Use `@heroui/navbar` — it has built-in `NavbarMenuToggle` for responsive hamburger
- **Performance panel FPS:** Use `requestAnimationFrame` loop, compute delta between frames
- **Performance panel memory:** `performance.memory` is Chrome-only; show "N/A" on other browsers
- **Right sidebar binding:** Use Fabric.js events, NOT polling. Listen for `selection:*` and `object:modified`
- **Feature cards icons:** Use Hugeicons (already in project) for consistent icon style
