import { Suspense } from "react";

import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";
import { W9EditorBootstrap } from "@/components/sections/forms/W9EditorBootstrap";
import { W9FinalizeIntercept } from "@/components/sections/forms/W9FinalizeIntercept";
import { W9FormFieldsPortal } from "@/components/sections/forms/W9FormFieldsPortal";

export const metadata = {
  title: "Fill Out W-9 Form — PDFVault",
  description:
    "Fill out the IRS Form W-9 online in your browser. Every field is highlighted; type, sign, and export a clean PDF using our full editor toolbox.",
};

// Short-URL entry point for the W-9 editor at `/w-9-form` — matches the
// competitor slug pattern (pdfguru.com/forms/w-9-form) so cross-site muscle
// memory + SEO for "w-9 form" queries lands on the right page.
//
// The editor UI is the same `<PdfEditorShell />` used by `/pdf-composer` so
// the W-9 route inherits the full toolbox (Add Text / Highlight / Draw /
// Sign / Image / Ellipse / Cross / Check / Annotations / Links / Manage
// Pages / thumbnails / undo-redo / Download). Extras layered on top:
//
//   - `<W9EditorBootstrap />` preloads the blank IRS W-9 template into
//     the shared pdf-composer store so the shell renders it as the initial
//     file, and starts a form-editor session so signature upload works.
//   - `<W9FormFieldsPortal />` layers the yellow tick-boxes / typed fields
//     / signature drop-zone on top of the pdf.js canvas so users see
//     exactly where to fill. Pointer-events yield to the pdf-composer
//     tools whenever the active tool is anything other than `select`.
//   - `<W9FinalizeIntercept />` hijacks the Download button on this route
//     so it routes through the form-session finalize backend (server
//     stamps values + signature onto the template) instead of pdf-composer's
//     Fabric-merge export. Mounted BEFORE the shell so its listener
//     registers first + can `stopImmediatePropagation` the export event.
export default function W9FormPage() {
  // `W9EditorBootstrap` calls `useSearchParams()` to read `?resumeDocId=<id>`
  // for the dashboard-resume flow. Next.js requires that any component tree
  // touching `useSearchParams()` be wrapped in a Suspense boundary so the
  // static prerender can bail cleanly. Fallback is `null` so nothing paints
  // while the client hydrates — `<W9EditorBootstrap />` renders its own
  // `EditorLoadingShell` immediately after mount.
  return (
    <Suspense fallback={null}>
      <W9EditorBootstrap>
        <W9FinalizeIntercept />
        <PdfEditorShell />
        <W9FormFieldsPortal />
      </W9EditorBootstrap>
    </Suspense>
  );
}
