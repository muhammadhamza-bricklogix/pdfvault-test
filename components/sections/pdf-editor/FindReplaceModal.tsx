"use client";

import type { Canvas as FabricCanvas } from "fabric";
import type { FindMatch } from "@/lib/client/pdf-editor/find-replace";

import { Button, Label, Modal, Switch } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";

import {
  applyReplaceAll,
  applyReplacement,
  findAllMatches,
  previewReplacement,
} from "@/lib/client/pdf-editor/find-replace";
import { usePdfEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

type Props = {
  fabricCanvas: FabricCanvas | null;
};

export function FindReplaceModal({ fabricCanvas }: Props) {
  const isOpen = usePdfEditorStore((s) => s.isFindReplaceOpen);
  const setIsOpen = usePdfEditorStore((s) => s.setIsFindReplaceOpen);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const pageCount = usePdfEditorStore((s) => s.pageCount);
  const pageOrder = usePdfEditorStore((s) => s.pageOrder);
  const fabricJsonByPage = usePdfEditorStore((s) => s.fabricJsonByPage);
  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const getSourcePageIndex = usePdfEditorStore((s) => s.getSourcePageIndex);
  const saveFabricJsonBySourcePage = usePdfEditorStore(
    (s) => s.saveFabricJsonBySourcePage,
  );
  // Find & Replace only sees IText overlays that `useEditTextMode` has
  // materialized on a page — pdf.js paints native text raster into the
  // canvas backing store, which the IText search can't index. QA
  // 2026-09-06: users search for visible words and get "No matches"
  // because they haven't hit the Edit Text tool yet. `extractedPages`
  // tracks which pages have been extracted, so we can detect that
  // state and surface a helpful hint instead of an unhelpful zero.
  // Auto-extracting on modal open is deliberately NOT done here — the
  // 2026-06-24 skill-log revert documents that auto-extract-on-load
  // drops white-on-coloured-background text to black on some PDFs
  // (colour extractor limitation). Users opt in per page via the
  // Edit Text tool.
  const extractedPages = usePdfEditorStore((s) => s.extractedPages);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);
  const activeTool = usePdfEditorStore((s) => s.activeTool);

  const [needle, setNeedle] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // Snapshot of the most recently replaced IText so the match status field
  // can show the user the new sentence they just produced — the replaced
  // occurrence drops out of `matches` immediately (no longer matches the
  // needle), so without this they'd jump straight to the next match.
  const [lastReplaced, setLastReplaced] = useState<{
    displayPage: number;
    snippet: string;
  } | null>(null);

  const options = useMemo(
    () => ({ caseSensitive, wholeWord }),
    [caseSensitive, wholeWord],
  );

  const liveSourcePage = getSourcePageIndex(currentPage);

  // Recompute matches whenever the search inputs or doc state change. Cheap —
  // editModeText overlays are small text strings, page count usually < 100.
  const matches = useMemo<FindMatch[]>(() => {
    if (!needle) return [];

    return findAllMatches({
      fabricJsonByPage,
      liveCanvas: fabricCanvas,
      liveDisplayPage: currentPage,
      liveSourcePage,
      needle,
      options,
      pageOrder,
      pageCount,
    });
    // Intentionally depend on fabricJsonByPage IDENTITY so a replace
    // refreshes the list.
  }, [
    currentPage,
    fabricCanvas,
    fabricJsonByPage,
    liveSourcePage,
    needle,
    options,
    pageCount,
    pageOrder,
  ]);

  // Cmd/Ctrl+F opens the dialog. We intentionally hijack the browser's
  // native Find because it can't see the IText overlays (they're inside a
  // <canvas>), so the native UI returns "no matches" on documents that
  // visibly contain the search term.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isFindShortcut =
        (e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F");

      if (!isFindShortcut) return;
      e.preventDefault();
      setIsOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setIsOpen]);

  // Auto-navigate to the page that contains the highlighted match. Without
  // this, "Find next" on page 5 leaves the user staring at page 1.
  useEffect(() => {
    const m = matches[activeIndex];

    if (!m || m.displayPage === currentPage) return;
    setCurrentPage(m.displayPage);
  }, [activeIndex, currentPage, matches, setCurrentPage]);

  const handleClose = () => {
    setIsOpen(false);
  };

  // iOS scrolls the page to show the focused input; restore it on close so the editor top bar stays visible.
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const { scrollX, scrollY } = window;

    return () => {
      const active = document.activeElement;

      if (active instanceof HTMLElement) active.blur();
      requestAnimationFrame(() => {
        if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
          window.scrollTo(scrollX, scrollY);
        }
      });
    };
  }, [isOpen]);

  const goNext = () => {
    if (matches.length === 0) return;
    setActiveIndex((i) => (i + 1) % matches.length);
  };

  const goPrev = () => {
    if (matches.length === 0) return;
    setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
  };

  const handleReplaceOne = () => {
    const m = matches[activeIndex];

    if (!m) return;
    const ok = applyReplacement({
      fabricJsonByPage,
      liveCanvas: fabricCanvas,
      liveDisplayPage: currentPage,
      match: m,
      needle,
      options,
      replacement,
      saveFabricJsonBySourcePage,
    });

    if (!ok) {
      toast.info({
        title: "Nothing to replace",
        description: "The selected text no longer matches.",
      });

      return;
    }
    setLastReplaced({
      displayPage: m.displayPage,
      snippet: previewReplacement(m.snippet, needle, replacement, options),
    });
    // After the swap, the refreshed matches list (memo deps on
    // `fabricJsonByPage` identity) drops the replaced occurrence. The
    // dual "Replace Next" action means: replace the current match, then
    // move the cursor to the next one. Two cases:
    //
    //   • The user was at the LAST match → wrap to index 0 (matching IDE
    //     convention: VS Code, IntelliJ, etc. all wrap on Replace Next).
    //   • Otherwise → keep `activeIndex` unchanged; since the replaced
    //     match drops out, the same index now points at what was
    //     previously the next match.
    setActiveIndex((i) => {
      const newLength = matches.length - 1;

      if (newLength <= 0) return 0;
      if (i >= newLength) return 0;

      return i;
    });
  };

  const handleReplaceAll = () => {
    if (!needle) return;
    const replaced = applyReplaceAll({
      fabricJsonByPage,
      liveCanvas: fabricCanvas,
      liveDisplayPage: currentPage,
      liveSourcePage,
      needle,
      options,
      pageCount,
      pageOrder,
      replacement,
      saveFabricJsonBySourcePage,
    });

    setLastReplaced(null);
    toast.success({
      title: "Replace complete",
      description:
        replaced === 0
          ? "No matches were rewritten."
          : `Rewrote ${replaced} occurrence${replaced === 1 ? "" : "s"}.`,
    });
  };

  const currentMatch = matches[activeIndex];

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Container>
        {/* Top-anchored on phones (HeroUI defaults to a bottom sheet) so the keyboard doesn't push it. */}
        <Modal.Dialog className="!max-h-[calc(100dvh-32px)] !w-[92vw] !max-w-[520px] overflow-y-auto overscroll-contain max-sm:!mt-0">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Find &amp; Replace</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs text-default-500">
                Find
              </Label>
              <input
                autoFocus
                className="w-full rounded-md border border-default-200 px-3 py-2 text-base sm:text-sm"
                placeholder="Search text"
                type="text"
                value={needle}
                onChange={(e) => {
                  setNeedle(e.target.value);
                  setActiveIndex(0);
                  setLastReplaced(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.shiftKey) goPrev();
                    else goNext();
                  }
                }}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-default-500">
                Replace with
              </Label>
              <input
                className="w-full rounded-md border border-default-200 px-3 py-2 text-base sm:text-sm"
                placeholder="(leave empty to delete)"
                type="text"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Switch
                isSelected={caseSensitive}
                size="sm"
                onChange={() => {
                  setCaseSensitive((v) => !v);
                  setActiveIndex(0);
                }}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label className="text-sm">Match case</Label>
                </Switch.Content>
              </Switch>
              <Switch
                isSelected={wholeWord}
                size="sm"
                onChange={() => {
                  setWholeWord((v) => !v);
                  setActiveIndex(0);
                }}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label className="text-sm">Whole word</Label>
                </Switch.Content>
              </Switch>
            </div>

            <div className="space-y-1 rounded-md border border-default-200 bg-default-50 px-3 py-2 text-xs text-default-500">
              <div>
                {needle.length === 0 ? (
                  "Type something to search."
                ) : matches.length === 0 && !lastReplaced ? (
                  "No matches."
                ) : matches.length === 0 ? (
                  <span>No more matches.</span>
                ) : (
                  <span>
                    Match{" "}
                    <span className="font-medium text-default-700">
                      {activeIndex + 1}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-default-700">
                      {matches.length}
                    </span>
                    {currentMatch ? (
                      <>
                        {" "}
                        • page {currentMatch.displayPage} • &ldquo;
                        {currentMatch.snippet.slice(0, 60)}
                        {currentMatch.snippet.length > 60 ? "…" : ""}&rdquo;
                      </>
                    ) : null}
                  </span>
                )}
              </div>
              {lastReplaced ? (
                <div className="text-success-600">
                  Replaced on page {lastReplaced.displayPage} • &ldquo;
                  {lastReplaced.snippet.slice(0, 80)}
                  {lastReplaced.snippet.length > 80 ? "…" : ""}&rdquo;
                </div>
              ) : null}
            </div>

            {/* Guidance — QA 2026-09-06: users hit "No matches" on
                text they can see in the PDF because Find & Replace
                only searches text that has been prepared for editing.
                Show the hint whenever a needle has been typed AND
                zero matches exist AND the current page hasn't been
                extracted. Offer a one-click way to arm Edit Text for
                the current page so the next search covers it. */}
            {needle.length > 0 &&
            matches.length === 0 &&
            !extractedPages.has(liveSourcePage) ? (
              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p>
                  Find &amp; Replace only searches text you&apos;ve prepared for
                  editing. Click{" "}
                  <span className="font-semibold">Edit Text</span> on the page
                  you want to search, then try again.
                </p>
                <Button
                  className="w-full"
                  isDisabled={activeTool === "editText"}
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    // Trigger extraction of the current page by
                    // switching the tool. `useEditTextMode` picks up
                    // the flip and runs `extractTextBlocks` — same
                    // pipeline as clicking Edit Text from the toolbar.
                    // Modal stays open; once extraction lands, the
                    // memoised `matches` recomputes and the hint
                    // hides.
                    setActiveTool("editText");
                    toast.info({
                      title: "Preparing text",
                      description:
                        "Extracting text on this page — search results will appear in a moment.",
                    });
                  }}
                >
                  {activeTool === "editText"
                    ? "Preparing text…"
                    : "Enable text search on this page"}
                </Button>
              </div>
            ) : null}
          </Modal.Body>

          <Modal.Footer className="max-sm:flex-wrap">
            <Button
              isDisabled={matches.length === 0}
              size="sm"
              variant="secondary"
              onPress={goPrev}
            >
              Previous
            </Button>
            <Button
              isDisabled={matches.length === 0}
              size="sm"
              variant="secondary"
              onPress={goNext}
            >
              Next
            </Button>
            <Button
              aria-label="Replace current match and jump to the next match"
              isDisabled={matches.length === 0}
              size="sm"
              onPress={handleReplaceOne}
            >
              Replace Next
            </Button>
            <Button
              isDisabled={matches.length === 0}
              size="sm"
              onPress={handleReplaceAll}
            >
              Replace all
            </Button>
            {/* Explicit Close button — QA 2026-09-06: users report the
                modal doesn't close after Replace All. `Modal.CloseTrigger`
                (X icon top-right) + backdrop + Escape all work, but
                without a footer Close button after a completed action
                users don't know where to click. Adding it explicitly. */}
            <Button size="sm" variant="secondary" onPress={handleClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
