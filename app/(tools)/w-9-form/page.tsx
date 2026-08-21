import { PdfEditorShell } from "@/components/sections/pdf-editor/PdfEditorShell";
import { W9EditorBootstrap } from "@/components/sections/forms/W9EditorBootstrap";
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
// Pages / thumbnails / undo-redo / Download). `<W9EditorBootstrap />`
// preloads the blank IRS W-9 template into the shared pdf-composer store
// so the shell renders it as the initial file. `<W9FormFieldsPortal />`
// layers the yellow tick-boxes / typed fields / signature drop-zone on top
// of the pdf.js canvas so users see exactly where to fill; the overlay
// yields pointer-events to the pdf-composer tools whenever the active
// tool is anything other than `select`.
export default function W9FormPage() {
  return (
    <W9EditorBootstrap>
      <PdfEditorShell />
      <W9FormFieldsPortal />
    </W9EditorBootstrap>
  );
}
