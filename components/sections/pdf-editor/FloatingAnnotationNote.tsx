"use client";

import type { Canvas, FabricObject } from "fabric";

import { Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useIsMobile } from "@/lib/client/hooks/use-is-mobile";
import { serializeFabricCanvas } from "@/lib/client/pdf-editor/save-utils";
import { usePdfEditorStore } from "@/lib/client/stores";

type FloatingAnnotationNoteProps = {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  fabricCanvas: Canvas | null;
};

type AnnotationObject = FabricObject & {
  annotationKind?: string;
  editorType?: string;
  noteText?: string;
};

type NoteState = {
  left: number;
  text: string;
  top: number;
};

function isAnnotationNote(
  object: FabricObject | null | undefined,
): object is AnnotationObject {
  if (!object) return false;

  const candidate = object as AnnotationObject;

  return (
    candidate.editorType === "annotation" &&
    candidate.annotationKind === "sticky-note"
  );
}

export function FloatingAnnotationNote({
  canvasContainerRef,
  fabricCanvas,
}: FloatingAnnotationNoteProps) {
  const isMobile = useIsMobile();
  const zoom = usePdfEditorStore((s) => s.zoom);
  const [noteState, setNoteState] = useState<NoteState | null>(null);
  const [dockOffset, setDockOffset] = useState(70);
  const activeObjRef = useRef<AnnotationObject | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const focusRequestedRef = useRef(false);

  useLayoutEffect(() => {
    if (!isMobile) return;

    const dockEl = document.querySelector<HTMLElement>(
      '[aria-label="Editor dock"]',
    );

    if (!dockEl) return;

    const update = () => {
      setDockOffset(dockEl.getBoundingClientRect().height + 12);
    };

    update();

    const observer = new ResizeObserver(update);

    observer.observe(dockEl);

    return () => observer.disconnect();
  }, [isMobile]);

  useEffect(() => {
    const onFocusRequest = () => {
      focusRequestedRef.current = true;
      window.setTimeout(() => textAreaRef.current?.focus(), 0);
    };

    window.addEventListener("editor:focus-annotation-note", onFocusRequest);

    return () => {
      window.removeEventListener(
        "editor:focus-annotation-note",
        onFocusRequest,
      );
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas) return;

    const showNote = () => {
      const obj = fabricCanvas.getActiveObject();

      if (!isAnnotationNote(obj)) {
        setNoteState(null);
        activeObjRef.current = null;

        return;
      }

      activeObjRef.current = obj;

      const bound = obj.getBoundingRect();
      const container = canvasContainerRef.current;
      const containerRect = container?.getBoundingClientRect();
      const canvasRect = fabricCanvas
        .getElement()
        .parentElement?.getBoundingClientRect();
      const offsetX = canvasRect
        ? canvasRect.left - (containerRect?.left ?? 0)
        : 0;
      const offsetY = canvasRect
        ? canvasRect.top - (containerRect?.top ?? 0)
        : 0;
      const panelWidth = Math.min(420, Math.max(280, window.innerWidth - 32));
      const gap = 12;
      let left = offsetX + bound.left + bound.width + gap;
      let top = offsetY + bound.top + bound.height + gap;

      if (
        containerRect &&
        containerRect.left + left + panelWidth > window.innerWidth - 12
      ) {
        left = offsetX + bound.left - panelWidth - gap;
      }

      setNoteState({
        left: Math.max(8, left),
        text: typeof obj.noteText === "string" ? obj.noteText : "",
        top: Math.max(8, top),
      });

      if (focusRequestedRef.current) {
        focusRequestedRef.current = false;
        window.setTimeout(() => textAreaRef.current?.focus(), 0);
      }
    };

    const hideNote = () => {
      setNoteState(null);
      activeObjRef.current = null;
    };

    fabricCanvas.on("selection:created", showNote);
    fabricCanvas.on("selection:updated", showNote);
    fabricCanvas.on("selection:cleared", hideNote);
    fabricCanvas.on("object:moving", showNote);
    fabricCanvas.on("object:modified", showNote);

    showNote();

    return () => {
      fabricCanvas.off("selection:created", showNote);
      fabricCanvas.off("selection:updated", showNote);
      fabricCanvas.off("selection:cleared", hideNote);
      fabricCanvas.off("object:moving", showNote);
      fabricCanvas.off("object:modified", showNote);
    };
  }, [canvasContainerRef, fabricCanvas, zoom]);

  const persist = () => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    const store = usePdfEditorStore.getState();

    store.saveFabricJson(
      store.currentPage,
      serializeFabricCanvas(fabricCanvas),
    );
    store.markDocumentDirty();
  };

  const updateText = (value: string) => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    obj.noteText = value;
    setNoteState((state) => (state ? { ...state, text: value } : state));
    persist();
  };

  const commitNote = () => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    fabricCanvas.fire("object:modified", { target: obj });
    persist();
  };

  const close = () => {
    if (!fabricCanvas) return;

    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    setNoteState(null);
    activeObjRef.current = null;
  };

  const deleteNote = () => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    fabricCanvas.remove(obj);
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    persist();
    setNoteState(null);
    activeObjRef.current = null;
  };

  if (!noteState) return null;

  return (
    <aside
      aria-label="Annotation note"
      className={
        isMobile
          ? "pointer-events-auto fixed inset-x-3 z-50 flex max-h-[42vh] flex-col rounded-lg bg-[#FFD633] shadow-[0_12px_32px_rgba(15,23,42,0.22)]"
          : "pointer-events-auto absolute z-50 flex w-[min(420px,calc(100vw-32px))] max-w-[420px] flex-col rounded-lg bg-[#FFD633] shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
      }
      data-editor-overlay=""
      role="region"
      style={
        isMobile
          ? { bottom: dockOffset }
          : { left: noteState.left, top: noteState.top }
      }
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="text-base font-semibold text-slate-950">Note</span>
        <button
          aria-label="Close annotation note"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 transition hover:bg-black/10 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          type="button"
          onClick={close}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} />
        </button>
      </div>
      <textarea
        ref={textAreaRef}
        aria-label="Note text"
        className="min-h-40 flex-1 resize-none bg-transparent px-4 pb-4 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-700/60"
        placeholder="Add note"
        value={noteState.text}
        onBlur={commitNote}
        onChange={(event) => updateText(event.target.value)}
      />
      <div className="flex shrink-0 justify-end px-3 pb-3">
        <button
          aria-label="Delete annotation note"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-600 transition hover:bg-black/10 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          type="button"
          onClick={deleteNote}
        >
          <HugeiconsIcon icon={Delete02Icon} size={18} />
        </button>
      </div>
    </aside>
  );
}
