/**
 * One-time Fabric.js v6 customizations.
 *
 * Fabric v6's default `toObject()` (and therefore `canvas.toJSON()`)
 * only serializes properties from the class's own schema. Custom
 * properties we set in constructors (`editorType`, `pristine`,
 * `originalText`, `originalLeft`, `originalTop`, `pdfTextWidth`,
 * `name`) get DROPPED on the round-trip through `toJSON()` → DB →
 * `loadFromJSON()`.
 *
 * That breaks any downstream logic that depends on those props, e.g.
 * the merge pipeline's "did the user actually modify source text?"
 * detector — without `originalText` it can't compare and silently
 * picks the wrong save strategy (either preserving text but losing
 * the edit, or rasterising a page that didn't need it).
 *
 * The fix: monkey-patch `FabricObject.prototype.toObject` (the root
 * of every Fabric class) ONCE so it always appends our custom keys
 * to the `propertiesToInclude` list. Idempotent — `installFabricCustomizations`
 * tracks a module-level flag.
 *
 * Call `installFabricCustomizations()` from any module that needs the
 * custom props to round-trip. Currently called by `use-edit-text-mode`
 * at hook-mount time so the patch is in place before any IText is
 * created.
 */

const CUSTOM_PROPS = [
  "editorType",
  "pristine",
  "originalText",
  "originalLeft",
  "originalTop",
  // originalWidth/originalHeight = source-text bounding box at extraction
  // time. Used by merge-pdf.ts to whiteout the source word before drawing
  // the user's modified IText on top. Must round-trip through toJSON, or
  // we can't position the whiteout rectangle on Save.
  "originalWidth",
  "originalHeight",
  "pdfTextWidth",
  // Row 99/100 QA 2026-10-04: sticky-note metadata. Without these on
  // the universal CUSTOM_PROPS list, any `canvas.toJSON()` call that
  // doesn't route through `serializeFabricCanvas` drops them —
  // including the loadFromJSON cycles used by the merge pipeline's
  // offscreen renderer and the per-page restore on navigation. That
  // left annotations undetectable to `FloatingAnnotationNote` (no
  // `annotationKind`), unrecolourable (no `noteColor`), and blanked
  // out their body text (no `noteText`) after a save/reload.
  "annotationKind",
  "noteColor",
  "noteIcon",
  "noteText",
] as const;

let installed = false;

export async function installFabricCustomizations(): Promise<void> {
  if (installed) return;

  const fabric = await import("fabric");
  // FabricObject is the common ancestor — patching its prototype
  // covers IText, Rect, Image, etc. without per-class boilerplate.
  const proto = (
    fabric.FabricObject as unknown as {
      prototype: {
        toObject: (propertiesToInclude?: string[]) => Record<string, unknown>;
      };
    }
  ).prototype;

  const original = proto.toObject;

  proto.toObject = function patchedToObject(
    propertiesToInclude: string[] = [],
  ): Record<string, unknown> {
    // Pass the merged list to the original `toObject` so Fabric does
    // all the heavy lifting (matrix decomposition, gradients, etc.)
    // and then sprinkles our custom props on top.
    const merged = Array.from(
      new Set([...propertiesToInclude, ...CUSTOM_PROPS]),
    );

    return original.call(this, merged);
  };

  installed = true;
}
