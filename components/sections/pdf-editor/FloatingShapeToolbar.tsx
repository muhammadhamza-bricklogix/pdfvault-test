"use client";

import type { Canvas } from "fabric";

import {
  Copy02Icon,
  Delete02Icon,
  Link01Icon,
  LockIcon,
  SquareUnlock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, ButtonGroup, Toolbar, Tooltip } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import { isShapeObject, type ShapeFabricObject } from "./shape-object-utils";

type FloatingShapeToolbarProps = {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  fabricCanvas: Canvas | null;
};

type ToolbarState = {
  isAspectLocked: boolean;
  left: number;
  top: number;
};

export function FloatingShapeToolbar({
  canvasContainerRef,
  fabricCanvas,
}: FloatingShapeToolbarProps) {
  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null);
  const activeObjRef = useRef<ShapeFabricObject | null>(null);

  useEffect(() => {
    if (!fabricCanvas) return;

    const showToolbar = () => {
      const obj = fabricCanvas.getActiveObject();

      // Images get this toolbar too so they can be deleted without a keyboard.
      if (!isShapeObject(obj) && obj?.type !== "image") {
        setToolbarState(null);
        activeObjRef.current = null;

        return;
      }

      activeObjRef.current = obj as ShapeFabricObject;

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

      const isAspectLocked =
        (obj as ShapeFabricObject).shapeAspectLocked ?? true;

      if (obj.canvas) {
        obj.canvas.uniformScaling = isAspectLocked;
      }
      setToolbarState({
        isAspectLocked,
        left: offsetX + bound.left + bound.width / 2,
        top: offsetY + bound.top - 56,
      });
    };

    const hideToolbar = () => {
      if (activeObjRef.current?.canvas) {
        activeObjRef.current.canvas.uniformScaling = true;
      }
      setToolbarState(null);
      activeObjRef.current = null;
    };

    fabricCanvas.on("selection:created", showToolbar);
    fabricCanvas.on("selection:updated", showToolbar);
    fabricCanvas.on("selection:cleared", hideToolbar);
    fabricCanvas.on("object:moving", showToolbar);
    fabricCanvas.on("object:scaling", showToolbar);
    fabricCanvas.on("object:modified", showToolbar);

    return () => {
      fabricCanvas.off("selection:created", showToolbar);
      fabricCanvas.off("selection:updated", showToolbar);
      fabricCanvas.off("selection:cleared", hideToolbar);
      fabricCanvas.off("object:moving", showToolbar);
      fabricCanvas.off("object:scaling", showToolbar);
      fabricCanvas.off("object:modified", showToolbar);
    };
  }, [canvasContainerRef, fabricCanvas]);

  const deleteShape = () => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    fabricCanvas.remove(obj);
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    setToolbarState(null);
    activeObjRef.current = null;
  };

  const duplicateShape = async () => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    const clone = await obj.clone(["editorType", "linkUrl"]);

    clone.set({
      left: (obj.left ?? 0) + 16,
      shapeAspectLocked: obj.shapeAspectLocked ?? true,
      top: (obj.top ?? 0) + 16,
    });
    clone.setCoords();
    fabricCanvas.add(clone);
    fabricCanvas.setActiveObject(clone);
    fabricCanvas.renderAll();
    activeObjRef.current = clone;
  };

  const toggleAspectLock = () => {
    const obj = activeObjRef.current;

    if (!obj || !fabricCanvas) return;

    const nextValue = !(obj.shapeAspectLocked ?? true);

    obj.set("shapeAspectLocked", nextValue);
    if (obj.canvas) {
      obj.canvas.uniformScaling = nextValue;
    }
    obj.setCoords();
    fabricCanvas.renderAll();
    setToolbarState((state) =>
      state ? { ...state, isAspectLocked: nextValue } : state,
    );
  };

  const focusLink = () => {
    window.dispatchEvent(new CustomEvent("editor:open-shape-link"));
  };

  if (!toolbarState) return null;

  return (
    <div
      className="pointer-events-auto absolute z-50 -translate-x-1/2"
      // Opt out of PdfViewerCanvas's document-scoped swipe-nav — this
      // overlay is DOM-nested inside `viewerScrollRef` so without this
      // marker a horizontal swipe on its buttons would flip pages.
      data-editor-overlay=""
      style={{ left: toolbarState.left, top: Math.max(0, toolbarState.top) }}
    >
      <Toolbar
        isAttached
        aria-label="Shape actions"
        className="bg-[var(--color-background)] shadow-lg"
      >
        <ButtonGroup size="sm">
          <Tooltip delay={300}>
            <Button
              isIconOnly
              aria-label="Toggle aspect ratio lock"
              variant={toolbarState.isAspectLocked ? "ghost" : "tertiary"}
              onPress={toggleAspectLock}
            >
              <HugeiconsIcon
                icon={
                  toolbarState.isAspectLocked ? LockIcon : SquareUnlock02Icon
                }
                size={16}
              />
            </Button>
            <Tooltip.Content>
              <p>Aspect ratio</p>
            </Tooltip.Content>
          </Tooltip>
          <Tooltip delay={300}>
            <Button
              isIconOnly
              aria-label="Duplicate shape"
              variant="ghost"
              onPress={() => void duplicateShape()}
            >
              <ButtonGroup.Separator />
              <HugeiconsIcon icon={Copy02Icon} size={16} />
            </Button>
            <Tooltip.Content>
              <p>Duplicate</p>
            </Tooltip.Content>
          </Tooltip>
          <Tooltip delay={300}>
            <Button
              isIconOnly
              aria-label="Edit shape link"
              variant="ghost"
              onPress={focusLink}
            >
              <ButtonGroup.Separator />
              <HugeiconsIcon icon={Link01Icon} size={16} />
            </Button>
            <Tooltip.Content>
              <p>Link</p>
            </Tooltip.Content>
          </Tooltip>
          <Tooltip delay={300}>
            <Button
              isIconOnly
              aria-label="Delete shape"
              variant="ghost"
              onPress={deleteShape}
            >
              <ButtonGroup.Separator />
              <HugeiconsIcon icon={Delete02Icon} size={16} />
            </Button>
            <Tooltip.Content>
              <p>Delete</p>
            </Tooltip.Content>
          </Tooltip>
        </ButtonGroup>
      </Toolbar>
    </div>
  );
}
