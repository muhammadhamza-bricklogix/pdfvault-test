# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: uat/edit-text-height.spec.ts >> Edit-Text overlays match source paint (no size growth, no wrap)
- Location: tests/uat/edit-text-height.spec.ts:32:1

# Error details

```
Error: no extracted overlay should render on more than one line

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 36
```

# Page snapshot

```yaml
- generic [active]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - button "Editor menu" [ref=e4] [cursor=pointer]:
        - img
      - separator [ref=e5]
      - link "Home" [ref=e6] [cursor=pointer]:
        - /url: /
        - img "PDFVault" [ref=e7]
      - generic "Document" [ref=e9]: back-end-infrastructure.pdf
      - generic [ref=e10]:
        - button "Undo" [ref=e11] [cursor=pointer]:
          - img [ref=e12]
        - button "Redo" [disabled] [ref=e15]:
          - img [ref=e16]
      - button "🌐 EN" [ref=e18] [cursor=pointer]
      - button "Share via link" [disabled] [ref=e19]:
        - img [ref=e20]
        - text: Share via link
      - button "Download" [ref=e23] [cursor=pointer]:
        - text: Download
        - img
    - generic [ref=e24]:
      - listbox "Page thumbnails" [ref=e25]:
        - button "Add page" [ref=e27] [cursor=pointer]:
          - img
          - text: Add Page
        - generic [ref=e28]:
          - option "Page 1" [selected] [ref=e30] [cursor=pointer]:
            - button "Drag to reorder page 1" [ref=e31]: ⋮⋮
            - generic [ref=e34]: "1"
          - option "Page 2" [ref=e36] [cursor=pointer]:
            - button "Drag to reorder page 2" [ref=e37]: ⋮⋮
            - generic [ref=e40]: "2"
          - option "Page 3" [ref=e42] [cursor=pointer]:
            - button "Drag to reorder page 3" [ref=e43]: ⋮⋮
            - generic [ref=e46]: "3"
          - option "Page 4" [ref=e48] [cursor=pointer]:
            - button "Drag to reorder page 4" [ref=e49]: ⋮⋮
            - generic [ref=e52]: "4"
          - option "Page 5" [ref=e54] [cursor=pointer]:
            - button "Drag to reorder page 5" [ref=e55]: ⋮⋮
            - generic [ref=e58]: "5"
          - option "Page 6" [ref=e60] [cursor=pointer]:
            - button "Drag to reorder page 6" [ref=e61]: ⋮⋮
            - generic [ref=e64]: "6"
          - option "Page 7" [ref=e66] [cursor=pointer]:
            - button "Drag to reorder page 7" [ref=e67]: ⋮⋮
            - generic [ref=e70]: "7"
          - option "Page 8" [ref=e72] [cursor=pointer]:
            - button "Drag to reorder page 8" [ref=e73]: ⋮⋮
            - generic [ref=e76]: "8"
          - option "Page 9" [ref=e78] [cursor=pointer]:
            - button "Drag to reorder page 9" [ref=e79]: ⋮⋮
            - generic [ref=e82]: "9"
          - option "Page 10" [ref=e84] [cursor=pointer]:
            - button "Drag to reorder page 10" [ref=e85]: ⋮⋮
            - generic [ref=e88]: "10"
          - option "Page 11" [ref=e90] [cursor=pointer]:
            - button "Drag to reorder page 11" [ref=e91]: ⋮⋮
            - generic [ref=e94]: "11"
          - option "Page 12" [ref=e96] [cursor=pointer]:
            - button "Drag to reorder page 12" [ref=e97]: ⋮⋮
            - generic [ref=e100]: "12"
        - status [ref=e101]
      - generic [ref=e102]:
        - generic [ref=e104]:
          - generic [ref=e105]:
            - button "Select" [ref=e106] [cursor=pointer]:
              - img [ref=e107]
              - generic [ref=e109]: Select
            - button "Edit" [pressed] [ref=e110] [cursor=pointer]:
              - img [ref=e111]
              - generic [ref=e113]: Edit
            - button "Sign" [ref=e114] [cursor=pointer]:
              - img [ref=e115]
              - generic [ref=e117]: Sign
            - button "Text" [ref=e118] [cursor=pointer]:
              - img [ref=e119]
              - generic [ref=e122]: Text
            - button "Draw" [ref=e123] [cursor=pointer]:
              - img [ref=e124]
              - generic [ref=e127]: Draw
            - button "Highlight" [ref=e128] [cursor=pointer]:
              - img [ref=e129]
              - generic [ref=e131]: Highlight
          - generic [ref=e132]:
            - button "Shapes" [ref=e133] [cursor=pointer]:
              - img [ref=e134]
              - generic [ref=e136]: Shapes
            - button "Eraser" [ref=e137] [cursor=pointer]:
              - img [ref=e138]
              - generic [ref=e141]: Eraser
            - button "Whiteout" [ref=e142] [cursor=pointer]:
              - img [ref=e143]
              - generic [ref=e146]: Whiteout
            - button "Redact" [ref=e147] [cursor=pointer]:
              - img [ref=e148]
              - generic [ref=e154]: Redact
            - button "Image" [ref=e155] [cursor=pointer]:
              - img [ref=e156]
              - generic [ref=e160]: Image
            - button "Watermark" [ref=e161] [cursor=pointer]:
              - img [ref=e162]
              - generic [ref=e165]: Watermark
            - button "Background" [ref=e166] [cursor=pointer]:
              - img [ref=e167]
              - generic [ref=e174]: Background
          - generic [ref=e175]:
            - button "Compress" [ref=e176] [cursor=pointer]:
              - img [ref=e177]
              - generic [ref=e179]: Compress
            - button "Secure" [ref=e180] [cursor=pointer]:
              - img [ref=e181]
              - generic [ref=e184]: Secure
            - button "Merge" [ref=e185] [cursor=pointer]:
              - img [ref=e186]
              - generic [ref=e189]: Merge
            - button "Split" [ref=e190] [cursor=pointer]:
              - img [ref=e191]
              - generic [ref=e194]: Split
            - button "Flatten" [ref=e195] [cursor=pointer]:
              - img [ref=e196]
              - generic [ref=e200]: Flatten
            - button "Extract" [ref=e201] [cursor=pointer]:
              - img [ref=e202]
              - generic [ref=e205]: Extract
            - button "Page No" [ref=e206] [cursor=pointer]:
              - img [ref=e207]
              - generic [ref=e210]: Page No
            - button "Annotate" [ref=e211] [cursor=pointer]:
              - img [ref=e212]
              - generic [ref=e215]: Annotate
          - button "Manage Pages" [ref=e217] [cursor=pointer]:
            - img [ref=e218]
            - generic [ref=e220]: Manage Pages
        - generic [ref=e224]:
          - img "PDF page 1 of 12" [ref=e225]
          - application "PDF editing canvas, page 1 of 12" [ref=e227]
      - button "Performance panel" [ref=e230] [cursor=pointer]:
        - button "Performance panel" [ref=e231]:
          - img
  - generic [ref=e236] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e237]:
      - img [ref=e238]
    - generic [ref=e241]:
      - button "Open issues overlay" [ref=e242]:
        - generic [ref=e243]:
          - generic [ref=e244]: "2"
          - generic [ref=e245]: "3"
        - generic [ref=e246]:
          - text: Issue
          - generic [ref=e247]: s
      - button "Collapse issues badge" [ref=e248]:
        - img [ref=e249]
  - alert [ref=e251]
```

# Test source

```ts
  38  |   await expect(
  39  |     page.getByRole("img", { name: /PDF page/i }).first(),
  40  |   ).toBeVisible({ timeout: 20_000 });
  41  | 
  42  |   // Wait until the harness has the store + canvas ready.
  43  |   await page.waitForFunction(
  44  |     () =>
  45  |       !!window.__PDF_EDITOR_TEST__?.fabricCanvas &&
  46  |       !!window.__PDF_EDITOR_TEST__?.getStore?.(),
  47  |     { timeout: 20_000 },
  48  |   );
  49  | 
  50  |   // Fire the Edit toolbar tool. The `select` gate at
  51  |   // `use-edit-text-mode.ts` runs on `activeTool === "editText"`, so
  52  |   // flip the store value directly to keep the probe independent of
  53  |   // toolbar-DOM changes.
  54  |   await page.evaluate(() => {
  55  |     window.__PDF_EDITOR_TEST__!.getStore().setActiveTool("editText");
  56  |   });
  57  | 
  58  |   // Wait for the page to land in `extractedPages` — that's the flag
  59  |   // `useEditTextMode` sets after IText objects are on the canvas.
  60  |   await page.waitForFunction(
  61  |     () => {
  62  |       const store = window.__PDF_EDITOR_TEST__?.getStore();
  63  | 
  64  |       if (!store) return false;
  65  | 
  66  |       return store.extractedPages.has(
  67  |         store.getSourcePageIndex(store.currentPage),
  68  |       );
  69  |     },
  70  |     { timeout: 20_000 },
  71  |   );
  72  | 
  73  |   // Read every `editModeText` overlay's rendered geometry back out.
  74  |   // Fabric exposes `_textLines` after `initDimensions` runs; each entry
  75  |   // is one visually rendered line. `.height` on the object is the
  76  |   // Textbox's total rendered height. `.fontSize` is what we authored.
  77  |   // `originalHeight` is `block.height`, the pdf.js cap-height.
  78  |   const overlays = await page.evaluate(() => {
  79  |     const canvas = window.__PDF_EDITOR_TEST__!.fabricCanvas!;
  80  | 
  81  |     return canvas
  82  |       .getObjects()
  83  |       .filter((o) => (o as any).editorType === "editModeText")
  84  |       .map((o) => {
  85  |         const any = o as {
  86  |           text: string;
  87  |           fontSize: number;
  88  |           height: number;
  89  |           originalHeight?: number;
  90  |           originalWidth?: number;
  91  |           width?: number;
  92  |           _textLines?: string[];
  93  |           lineHeight?: number;
  94  |         };
  95  | 
  96  |         return {
  97  |           text: (any.text ?? "").slice(0, 60),
  98  |           fontSize: any.fontSize,
  99  |           renderedHeight: any.height,
  100 |           sourceHeight: any.originalHeight ?? any.fontSize,
  101 |           sourceWidth: any.originalWidth,
  102 |           boxWidth: any.width,
  103 |           lines: any._textLines?.length ?? 1,
  104 |           lineHeight: any.lineHeight ?? 1,
  105 |         };
  106 |       });
  107 |   });
  108 | 
  109 |   console.log(
  110 |     `[edit-text-probe] extracted overlays: ${overlays.length} (fixture: Back-end_infrastructure.pdf)`,
  111 |   );
  112 | 
  113 |   const sample = overlays.slice(0, 4).map((o) => ({
  114 |     text: o.text,
  115 |     fontSize: o.fontSize,
  116 |     box: o.boxWidth,
  117 |     src: o.sourceWidth,
  118 |     lines: o.lines,
  119 |   }));
  120 | 
  121 |   console.log("[edit-text-probe] first-4 overlays:", JSON.stringify(sample));
  122 | 
  123 |   expect(overlays.length, "extraction produced overlays").toBeGreaterThan(5);
  124 | 
  125 |   // No hidden second line — the "text collapses / stacks when Edit
  126 |   // activates" bug from 2026-07-22.
  127 |   const multiline = overlays.filter((o) => o.lines > 1);
  128 | 
  129 |   if (multiline.length > 0) {
  130 |     console.log(
  131 |       "[edit-text-probe] MULTILINE overlays:",
  132 |       multiline.map((o) => `"${o.text}" lines=${o.lines}`).join(" | "),
  133 |     );
  134 |   }
  135 |   expect(
  136 |     multiline.length,
  137 |     "no extracted overlay should render on more than one line",
> 138 |   ).toBe(0);
      |     ^ Error: no extracted overlay should render on more than one line
  139 | 
  140 |   // No visible size growth — the 2026-07-23 lineHeight bug. The Fabric
  141 |   // rendered height should sit within 4 % of the source cap-height for
  142 |   // upright text. Allow a small slack for antialias rounding.
  143 |   const grew = overlays.filter(
  144 |     (o) => o.renderedHeight > o.sourceHeight * 1.04,
  145 |   );
  146 | 
  147 |   if (grew.length > 0) {
  148 |     console.log(
  149 |       "[edit-text-probe] GROWN overlays:",
  150 |       grew
  151 |         .slice(0, 8)
  152 |         .map(
  153 |           (o) =>
  154 |             `"${o.text}" rendered=${o.renderedHeight.toFixed(1)} source=${o.sourceHeight.toFixed(1)}`,
  155 |         )
  156 |         .join(" | "),
  157 |     );
  158 |   }
  159 |   expect(
  160 |     grew.length,
  161 |     "no extracted overlay should render taller than 104 % of the source cap-height",
  162 |   ).toBe(0);
  163 | 
  164 |   // Author-side sanity: every overlay should carry lineHeight: 1.
  165 |   const wrongLineHeight = overlays.filter((o) => Math.abs(o.lineHeight - 1) > 0.001);
  166 | 
  167 |   expect(
  168 |     wrongLineHeight.length,
  169 |     "all extracted overlays should carry lineHeight: 1",
  170 |   ).toBe(0);
  171 | });
  172 | 
```