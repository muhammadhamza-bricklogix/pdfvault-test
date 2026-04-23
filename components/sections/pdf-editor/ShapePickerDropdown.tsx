"use client";

import type { ShapeType } from "@/lib/client/stores/pdf-editor-store";

import {
  ArrowDiagonalIcon,
  CircleIcon,
  LineIcon,
  Square01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Popover } from "@heroui/react";

import { usePdfEditorStore } from "@/lib/client/stores";

const SHAPE_OPTIONS: {
  icon: typeof Square01Icon;
  label: string;
  type: ShapeType;
}[] = [
  { icon: Square01Icon, label: "Rectangle", type: "rect" },
  { icon: CircleIcon, label: "Ellipse", type: "ellipse" },
  { icon: LineIcon, label: "Line", type: "line" },
  { icon: ArrowDiagonalIcon, label: "Arrow", type: "arrow" },
];

export function ShapePickerDropdown() {
  const activeShapeType = usePdfEditorStore((s) => s.activeShapeType);
  const setActiveShapeType = usePdfEditorStore((s) => s.setActiveShapeType);
  const setActiveTool = usePdfEditorStore((s) => s.setActiveTool);

  const handleSelect = (type: ShapeType) => {
    setActiveShapeType(type);
    setActiveTool("shape");
  };

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          isIconOnly
          aria-label="Choose shape type"
          size="sm"
          variant="ghost"
        >
          <HugeiconsIcon icon={Square01Icon} size={12} />
        </Button>
      </Popover.Trigger>
      <Popover.Content>
        <Popover.Dialog>
          <div className="flex gap-1 p-1">
            {SHAPE_OPTIONS.map((opt) => (
              <Button
                key={opt.type}
                isIconOnly
                aria-label={opt.label}
                size="sm"
                variant={activeShapeType === opt.type ? "primary" : "ghost"}
                onPress={() => handleSelect(opt.type)}
              >
                <HugeiconsIcon icon={opt.icon} size={16} />
              </Button>
            ))}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
