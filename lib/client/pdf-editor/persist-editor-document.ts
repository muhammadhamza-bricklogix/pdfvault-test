import type { Canvas as FabricCanvas } from "fabric";
import type { QueryClient } from "@tanstack/react-query";
import type { Document } from "@/lib/shared/types/documents.types";
import type { BuildEditedPdfRemappedState } from "@/lib/client/pdf-editor/save-utils";

import { documentsService } from "@/lib/shared/api/services/documents.service";
import { requestDuplicatePrompt } from "@/lib/client/hooks/documents/duplicate-prompt-bus";
import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { buildEditedPdfBytes } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";
import { documentKeys } from "@/lib/shared/constants/query-keys";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

// 2026-08-28: `persistEditorDocument` calls `documentsService.uploadDocument`
// directly (not through a `useMutation` hook) so the tanstack query cache
// isn't invalidated automatically. Without this, the dashboard's file list
// and any `documentKeys.detail(id)` consumers keep serving pre-save
// metadata — including the stale signed URL — so when the user reopens
// the freshly-saved file the loader can fetch the OLD bytes from a
// cached signed URL and it looks like the save was lost.
// QueryProvider registers the app-level client here on mount and
// clears it on unmount (mirrors `setPendingConversionsQueryClient`).
let editorSaveQueryClient: QueryClient | null = null;

export function setEditorSaveQueryClient(client: QueryClient | null): void {
  editorSaveQueryClient = client;
}

// Reject editor-state payloads larger than ~950 KB BEFORE we send. The
// backend rejects > 1 MiB outright; this leaves 74 KB headroom for HTTP
// overhead + the signed multipart envelope. Raised from 800 KB on
// 2026-08-28 after users hit the silent trim path with typical watermark
// / background image sizes. The `compressImageDataUrl` helper called by
// the upload UIs already downscales user images so they should never
// need the trim path — this cap is a belt-and-braces guard only.
const EDITOR_STATE_SOFT_LIMIT_BYTES = 950 * 1024;

type PristineSweepResult = {
  map: Map<number, string>;
  mutated: boolean;
  mutatedCount: number;
  strippedPageNumbers: number;
};

/**
 * Walks a `fabricJsonByPage` Map and, for every editModeText whose
 * `pristine !== true`, snaps `originalText/originalLeft/originalTop/...` to
 * the current values and flips `pristine` to true. Also strips any
 * `pageNumber` overlays — those have been baked into the source bytes by
 * the merge and the surviving overlay would double-paint on reload.
 *
 * Pure: returns a new Map; does NOT mutate the input or the store. The
 * identity-pageOrder save path writes the result back to the store
 * directly; the materialized-reorder path threads the result through
 * `remappedState` so the commit lands atomically in `applyPostSaveReset`
 * post-upload, leaving the store untouched on upload failure.
 *
 * Why: the merge pipeline just baked the user's modifications into the
 * saved bytes via whiteout + drawText. The user's NEXT save (or a reload
 * that reuses the snapshot) must treat those entries as "no modification
 * pending" — otherwise the whiteout-and-redraw runs again, stacking on
 * top of the already-baked text in the saved file (and producing a visual
 * mess in the editor where pdf.js's text-extraction sees both layers).
 */
function applyPristineSweep(
  fabricJsonByPage: Map<number, string>,
): PristineSweepResult {
  const next = new Map<number, string>();
  let mutatedCount = 0;
  // Retained on the return shape so existing callers' log fields stay typed,
  // but always 0 now — `pageNumber` overlays are never baked (the strip lives
  // in `buildEditedPdfBytes` pre-merge instead, see skill 2026-06-19 (d)) so
  // there's nothing to strip post-merge.
  const strippedPageNumbers = 0;

  fabricJsonByPage.forEach((json, page) => {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      next.set(page, json);

      return;
    }

    const objs = parsed.objects;

    if (!Array.isArray(objs)) {
      next.set(page, json);

      return;
    }

    let changed = false;
    const objsArr = objs as Record<string, unknown>[];

    for (const obj of objsArr) {
      if (obj.editorType !== "editModeText") continue;
      if (obj.pristine === true) continue;
      obj.originalText = obj.text;
      obj.originalLeft = obj.left;
      obj.originalTop = obj.top;

      if (obj.width !== undefined) obj.originalWidth = obj.width;
      if (obj.height !== undefined) obj.originalHeight = obj.height;
      obj.pristine = true;
      changed = true;
      mutatedCount++;
    }

    // Strip overlays that the merge just baked into the saved bytes.
    // Keeping them here would cause a visible double-render on reload:
    // pdf.js paints them from the baked PDF AND Fabric re-draws them on
    // top of that. Highlights compound their 40% alpha and appear
    // noticeably darker; shapes ghost from anti-aliasing mismatch
    // between pdf.js and Fabric. Only two overlay types are kept:
    //
    //   • editModeText — 2026-06-17 fix requires preserving these
    //     (with the pristine flag set above) so pdf.js text extraction
    //     doesn't re-surface source words under whiteouts. The `pristine`
    //     flag also makes them no-ops in the next Case 3 merge.
    //
    //   • pageNumber — never baked at all (stripped pre-merge in
    //     `buildEditedPdfBytes`, per 2026-06-19 (d)). Must survive so
    //     the editor renders the labels via Fabric on reload.
    //
    // Trade-off: shapes / highlights / watermarks / arrows / signatures
    // / drawings / user-added images live in the baked PDF but are no
    // longer interactive Fabric objects. Matches the original 2026-06-09
    // design intent — the user re-draws to modify, otherwise the baked
    // copy is the source of truth. Undo also stops at the save point;
    // history is cleared in `applyPostSaveReset` for the same reason.
    const filteredObjs = objsArr.filter((obj) => {
      const editorType = obj.editorType;

      return editorType === "editModeText" || editorType === "pageNumber";
    });

    if (filteredObjs.length !== objsArr.length) {
      parsed.objects = filteredObjs;
      changed = true;
    } else if (changed) {
      parsed.objects = objsArr;
    }

    if (changed) {
      next.set(page, JSON.stringify(parsed));
    } else {
      next.set(page, json);
    }
  });

  const mutated = mutatedCount > 0;

  return { map: next, mutated, mutatedCount, strippedPageNumbers };
}

export type PersistEditorResult =
  | {
      document: Document;
      ok: true;
      /**
       * Sidebar-reorder-aware editor state that the caller commits via
       * `applyPostSaveReset` once the upload succeeds. Present iff the user
       * had drag-dropped pages since the last save; absent for identity
       * pageOrder saves.
       */
      remappedState?: BuildEditedPdfRemappedState;
      savedFile: File;
    }
  | {
      ok: false;
      reason:
        | "error"
        | "no-changes"
        | "no-file"
        | "not-signed-in"
        | "not-loaded"
        // The file has a filename twin in the user's library, and the
        // user picked Cancel on the duplicate-filename prompt. Caller
        // should treat this as an intentional skip — no error toast,
        // no navigation blocked.
        | "cancelled-duplicate";
    };

type PersistEditorDocumentInput = {
  fabricCanvas?: FabricCanvas | null;
  /**
   * Bypasses the `hasUnsavedChanges` short-circuit. Set to `true` for code
   * paths that produce a NEW source file even when the Fabric overlay is empty
   * — e.g. Manage Pages reorder/import/rotate, which rebuilds the PDF bytes
   * outside the dirty-flag system.
   */
  force?: boolean;
  /**
   * Turn on the "file already exists in your library" prompt. Runs
   * BEFORE the first upload for a signed-in user without a
   * `currentDocumentId`. Matches the QA 2026-09-06 requirement: any
   * composer tool that saves a fresh file must ask the user
   * "Overwrite / Cancel" instead of silently creating a duplicate
   * row or failing on the backend uniqueness check.
   *
   * Callers that already carry a `currentDocumentId` (Save button on
   * a previously-saved doc, restore-version, etc.) short-circuit past
   * this check — the caller has explicitly claimed the row.
   */
  checkFilenameDuplicate?: boolean;
};

/**
 * Builds the current editor PDF (with Fabric overlays) and uploads it to the cloud.
 * Used by Save, Manage Pages auto-save, and save-before-navigate flows.
 */
export async function persistEditorDocument({
  fabricCanvas = null,
  force = false,
  checkFilenameDuplicate = false,
}: PersistEditorDocumentInput = {}): Promise<PersistEditorResult> {
  const state = usePdfEditorStore.getState();
  const { currentPage, file, hasUnsavedChanges, isSignedIn, pdfDocument } =
    state;
  // Reassigned after the duplicate-overwrite branch may stamp the
  // store, so the downstream upload sees the freshly-adopted id.
  let currentDocumentId = state.currentDocumentId;

  if (!file) {
    return { ok: false, reason: "no-file" };
  }

  if (!isSignedIn) {
    return { ok: false, reason: "not-signed-in" };
  }

  if (!pdfDocument) {
    return { ok: false, reason: "not-loaded" };
  }

  // Skip the upload if nothing has changed since the last save AND a cloud
  // document already exists. Without this, every Save/back-navigate/page-hide
  // re-uploads byte-identical PDF bytes — wasteful and creates duplicate
  // history entries on the server. The first save (no `currentDocumentId`
  // yet) always proceeds so a fresh PDF gets uploaded once.
  if (!force && !hasUnsavedChanges && currentDocumentId) {
    return { ok: false, reason: "no-changes" };
  }

  // Duplicate-filename gate. Only fires for the FIRST save on a fresh
  // file (no `currentDocumentId` yet). If the user's library already
  // contains a doc with the same filename, prompt: Overwrite / Cancel.
  //   - Overwrite → stamp the store's `currentDocumentId` with the
  //     existing row's id, so the upload below turns into an upsert
  //     (backend versions the previous bytes as a snapshot).
  //   - Cancel    → return early with `cancelled-duplicate`. Caller
  //     leaves the local edits in place and shows no error toast.
  // Backwards-compatible: `checkFilenameDuplicate` defaults to false,
  // so existing call sites (Manage Pages auto-persist, page-hide
  // background save, etc.) keep behaving exactly as before until they
  // opt in.
  if (checkFilenameDuplicate && !currentDocumentId) {
    let existing: Document | null = null;

    try {
      existing = await findDuplicateByFilename(file.name);
    } catch (err) {
      // Silent — a flaky list call must not block the save. Log for
      // diagnostics; fall through to the standard upload path.
      logger.captureError(err, "save.duplicate_check");
    }

    if (existing) {
      const outcome = await requestDuplicatePrompt({
        filename: existing.filename,
        existing,
      });

      if (outcome === "cancel") {
        logger.event("save.duplicate_cancelled", "info", {
          filename: existing.filename,
        });

        return { ok: false, reason: "cancelled-duplicate" };
      }

      logger.event("save.duplicate_overwrite", "info", {
        filename: existing.filename,
        documentId: existing.id,
      });
      // Claim the existing row so the upload below versions it via the
      // backend's documentId branch. `setCurrentDocument` also updates
      // any downstream selector that keys off the current doc id.
      usePdfEditorStore.getState().setCurrentDocument({
        id: existing.id,
        name: existing.filename,
      });
      // Re-point the local variable so `effectiveDocumentId` further
      // down picks up the just-claimed id.
      currentDocumentId = existing.id;
    }
  }

  try {
    // Save path uses the default `bakeOverlays: false` — the cloud-saved PDF
    // contains user edits (text, shapes, highlights, etc.) but NOT the
    // watermark or background image. Those live in `editorState` as
    // overlay metadata and are re-applied at view-time and at Export.
    // Keeping them out of the saved bytes prevents per-save stacking and the
    // text-position drift caused by re-rasterizing the page on every save.
    const sourceSize = file.size;
    const fabricKeys = Array.from(
      usePdfEditorStore.getState().fabricJsonByPage.keys(),
    );

    logger.info("[PDFedits] save: pre-merge", {
      sourceFileBytes: sourceSize,
      fabricJsonPages: fabricKeys,
      currentPage,
      fabricCanvasPresent: !!fabricCanvas,
    });

    const { bytes: savedBytes, remappedState } = await buildEditedPdfBytes({
      currentPage,
      fabricCanvas,
      file,
    });

    logger.info("[PDFedits] save: post-merge", {
      sourceFileBytes: sourceSize,
      mergedBytes: savedBytes.byteLength,
      bytesIdenticalToSource: savedBytes.byteLength === sourceSize,
      remapped: !!remappedState,
    });

    // Mark every editModeText that the merge just baked as `pristine: true`,
    // and snap its `originalText` / `originalLeft` / `originalTop` etc. to
    // the current values. Reason: the saved bytes now contain the modified
    // text drawn on top of a whiteout, so on the NEXT save we should NOT
    // re-whiteout + re-draw (that would double-bake). Also keeps the editor's
    // Fabric overlay in sync with the just-saved file so the user doesn't see
    // a double-text artefact from pdf.js re-extracting both the source word
    // (under the whiteout) and our redraw.
    //
    // `pageNumber` overlays are NOT touched here — they were stripped from the
    // merge input upstream in `buildEditedPdfBytes` (so they were never baked
    // into the bytes) and must survive in `fabricJsonByPage` so the editor
    // renders them via Fabric on reload. See skill log 2026-06-19 (d).
    //
    // Two paths:
    //   • Identity pageOrder: sweep the store map, commit back to the store
    //     so the editorState built below carries pristine flags.
    //   • Materialized reorder: sweep the remapped (display-slot-keyed) map
    //     in-memory and thread it through `remappedState` so the post-upload
    //     `applyPostSaveReset` lands the pristined version atomically. The
    //     store still holds the OLD source-keyed map until that commit so an
    //     upload failure leaves the editor in a recoverable state.
    let finalRemappedState: BuildEditedPdfRemappedState | undefined;
    let editorStateMap: Map<number, string>;

    if (remappedState) {
      const swept = applyPristineSweep(remappedState.fabricJsonByPage);

      if (swept.mutated) {
        logger.info(
          "[PDFedits] save: post-merge fabricJsonByPage cleanup (remapped)",
          {
            pristinedEditModeText: swept.mutatedCount,
          },
        );
      }
      finalRemappedState = {
        extractedPages: remappedState.extractedPages,
        fabricJsonByPage: swept.map,
        historyByPage: remappedState.historyByPage,
        historyIndexByPage: remappedState.historyIndexByPage,
      };
      editorStateMap = swept.map;
    } else {
      const storeMap = usePdfEditorStore.getState().fabricJsonByPage;
      const swept = applyPristineSweep(storeMap);

      if (swept.mutated) {
        logger.info("[PDFedits] save: post-merge fabricJsonByPage cleanup", {
          pristinedEditModeText: swept.mutatedCount,
        });
        usePdfEditorStore.setState({ fabricJsonByPage: swept.map });
      }
      editorStateMap = swept.map;
    }

    const savedFile = new File([savedBytes.buffer as ArrayBuffer], file.name, {
      type: "application/pdf",
    });

    // `buildEditedPdfBytes` flushes the *current* page into `fabricJsonByPage`
    // and the materialized-reorder path further remaps it, so the state
    // snapshot captured at the top of this function is stale. Re-read the
    // store for everything EXCEPT `fabricJsonByPage`, which we override with
    // the (possibly remapped) swept map above so the editorState matches
    // the saved bytes exactly (QA report 2026-06-17).
    const editorState = buildEditorStateJson(
      usePdfEditorStore.getState(),
      editorStateMap,
      finalRemappedState?.extractedPages,
    );

    // Belt-and-braces: fall back to `?id=<docId>` from the URL if the store's
    // `currentDocumentId` was cleared (StrictMode double-mount, loader race,
    // etc.). Sending no `documentId` makes the backend create a fresh
    // Document row and skip the version snapshot — reported 2026-07-23 as
    // "save happens but version history not created" on nav-save.
    const urlDocumentId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id") || undefined
        : undefined;
    const effectiveDocumentId = currentDocumentId ?? urlDocumentId;

    logger.info("[PDFedits] save: request", {
      documentId: effectiveDocumentId,
      documentIdSource:
        currentDocumentId !== null
          ? "store"
          : urlDocumentId
            ? "url-fallback"
            : "none",
      hasUnsavedChanges,
      force,
    });

    const document = await documentsService.uploadDocument({
      documentId: effectiveDocumentId,
      file: savedFile,
      editorState,
    });

    logger.info("[PDFedits] save: uploaded", {
      documentId: document.id,
      backendSizeBytes: document.sizeBytes,
      backendVersion: document.version,
    });

    usePdfEditorStore.setState({
      currentDocumentId: document.id,
      currentDocumentName: document.filename,
      hasUnsavedChanges: false,
    });

    // Invalidate the docs list + prime the detail cache so the dashboard
    // reflects the new size/updatedAt AND the next `useEditorDocumentLoader`
    // call for this id gets fresh metadata (fresh signed URL pointing at
    // the just-uploaded bytes) instead of a stale cached response. Without
    // this the user reopens the same doc and sees pre-save content — QA
    // report 2026-08-28 ("used draw tool, save toast fired, changes not
    // there on reopen"). Fire-and-forget: the save is already committed
    // server-side; a cache-refresh failure shouldn't block the caller.
    if (editorSaveQueryClient) {
      try {
        editorSaveQueryClient.setQueryData(
          documentKeys.detail(document.id),
          document,
        );
        void editorSaveQueryClient.invalidateQueries({
          queryKey: documentKeys.lists(),
        });
        void editorSaveQueryClient.invalidateQueries({
          queryKey: documentKeys.detail(document.id),
        });
      } catch (invalidateErr) {
        logger.warn("[PDFedits] save: cache invalidate failed", invalidateErr);
      }
    }

    return {
      document,
      ok: true,
      remappedState: finalRemappedState,
      savedFile,
    };
  } catch (err) {
    logger.error("Failed to persist editor document", err);

    return { ok: false, reason: "error" };
  }
}

/**
 * Build the JSON sent as `editorState` on the upload form. Envelope is
 * versioned so a future field shape change doesn't break the parser on docs
 * saved by older clients. Trims watermark/bg `imageData` when the payload
 * exceeds the soft cap.
 */
function buildEditorStateJson(
  state: ReturnType<typeof usePdfEditorStore.getState>,
  overrideFabricJsonByPage?: Map<number, string>,
  overrideExtractedPages?: Set<number>,
): string {
  // Overrides win when the caller has post-merge / post-materialize state
  // that the store doesn't reflect yet (sidebar-reorder save path).
  const fabricMap = overrideFabricJsonByPage ?? state.fabricJsonByPage;
  const extracted = overrideExtractedPages ?? state.extractedPages;
  const fabricJsonByPage = Object.fromEntries(fabricMap.entries());

  const full = {
    v: 1 as const,
    watermarkConfig: state.watermarkConfig,
    backgroundImageConfig: state.backgroundImageConfig,
    fabricJsonByPage,
    extractedPages: Array.from(extracted),
  };
  const serialized = JSON.stringify(full);

  // PERSIST-DIAG: summary of what's about to leave the browser as editorState.
  // Grep `[PDFedits] PERSIST-DIAG` in the console; if this shows
  // `watermarkImageDataStripped: true` or `bgImageDataStripped: true` on
  // reload the watermark / background image preview will blank because the
  // baked PDF doesn't carry them either (bakeOverlays: false on Save).
  try {
    const fabricSummary: Record<
      number,
      { objectCount: number; editorTypes: string[] }
    > = {};

    fabricMap.forEach((json, pageNum) => {
      try {
        const parsed = JSON.parse(json) as {
          objects?: { editorType?: string; type?: string }[];
        };
        const objs = parsed.objects ?? [];

        fabricSummary[pageNum] = {
          objectCount: objs.length,
          editorTypes: objs.map((o) => o.editorType ?? o.type ?? "?"),
        };
      } catch {
        fabricSummary[pageNum] = { objectCount: -1, editorTypes: [] };
      }
    });
    const wm = state.watermarkConfig;
    const bg = state.backgroundImageConfig;

    logger.info("[PDFedits] PERSIST-DIAG: buildEditorStateJson", {
      serializedLen: serialized.length,
      willTrim: serialized.length > EDITOR_STATE_SOFT_LIMIT_BYTES,
      softLimit: EDITOR_STATE_SOFT_LIMIT_BYTES,
      watermark: {
        enabled: wm.enabled,
        hasText: Boolean(wm.text),
        hasImageData: Boolean(wm.imageData),
        imageDataLen: wm.imageData ? wm.imageData.length : 0,
      },
      backgroundImage: {
        enabled: bg.enabled,
        hasImageData: Boolean(bg.imageData),
        imageDataLen: bg.imageData ? bg.imageData.length : 0,
      },
      fabricPages: Array.from(fabricMap.keys()),
      fabricSummary,
      extractedPages: Array.from(extracted),
    });
  } catch (diagErr) {
    logger.warn(
      "[PDFedits] PERSIST-DIAG: buildEditorStateJson log failed",
      diagErr,
    );
  }

  if (serialized.length <= EDITOR_STATE_SOFT_LIMIT_BYTES) {
    return serialized;
  }

  // Over cap — strip the inline image data URLs (these are by far the largest
  // contributors). The user's actual watermark IS in the baked PDF; this only
  // affects whether the UI panel can re-display the source image on reload.
  const trimmed = {
    v: 1 as const,
    watermarkConfig: { ...state.watermarkConfig, imageData: null },
    backgroundImageConfig: {
      ...state.backgroundImageConfig,
      imageData: null,
    },
    fabricJsonByPage,
    extractedPages: Array.from(extracted),
  };

  logger.warn(
    "[PDFedits] PERSIST-DIAG: editorState exceeded soft cap; dropped inline imageData URLs — reload will lose watermark/bg image PREVIEW (bytes not baked into cloud PDF because bakeOverlays:false on Save)",
    {
      originalLen: serialized.length,
      softLimit: EDITOR_STATE_SOFT_LIMIT_BYTES,
      watermarkHadImageData: Boolean(state.watermarkConfig.imageData),
      bgHadImageData: Boolean(state.backgroundImageConfig.imageData),
    },
  );

  // Surface the trim to the user — silent loss is what caused the
  // 2026-08-28 report ("half my edits gone on reopen"). The upload
  // UIs downscale user images to fit under the cap, so hitting this
  // branch means an unexpected payload size (e.g. huge fabricJsonByPage
  // from many overlays). Let the user know so they can reduce edits
  // or split the save.
  if (typeof window !== "undefined") {
    const droppedWatermark = Boolean(state.watermarkConfig.imageData);
    const droppedBg = Boolean(state.backgroundImageConfig.imageData);
    const parts: string[] = [];

    if (droppedWatermark) parts.push("watermark image");
    if (droppedBg) parts.push("background image");
    if (parts.length > 0) {
      toast.error({
        title: "Saved without live previews",
        description: `Your ${parts.join(" & ")} exceeded the save limit and won't reappear on reload. Use a smaller image.`,
      });
    }
  }

  return JSON.stringify(trimmed);
}
