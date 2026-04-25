import {
  CheckListIcon,
  File01Icon,
  FlashIcon,
  GroupLayersIcon,
  PaintBrush01Icon,
  SearchReplaceIcon,
  SecurityPasswordIcon,
  SignatureIcon,
  StampIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card } from "@heroui/react";

const FEATURE_CARDS = [
  {
    description:
      "Lightning-fast viewer with zoom, undo/redo, performance panel — even for large files",
    icon: FlashIcon,
    title: "Smart PDF Viewer",
  },
  {
    description:
      "Edit text directly on PDF with floating toolbar (fonts, colors, formatting)",
    icon: TextFontIcon,
    title: "Text & Object Editor",
  },
  {
    description:
      "Shapes, freehand brush, eraser, pressure sensitivity, images & more",
    icon: PaintBrush01Icon,
    title: "Drawing & Annotation Suite",
  },
  {
    description: "Draw, upload or type signatures and place them anywhere",
    icon: SignatureIcon,
    title: "Digital Signatures",
  },
  {
    description:
      "Turn PDFs into fillable forms (text fields, checkboxes, dropdowns, etc.)",
    icon: CheckListIcon,
    title: "Interactive Forms",
  },
  {
    description: "Full control: show/hide, lock, delete, reorder layers",
    icon: GroupLayersIcon,
    title: "Layers Panel",
  },
  {
    description:
      "Reorder pages (drag thumbnails), split, rotate, resize, add/remove blank pages",
    icon: File01Icon,
    title: "Page Manager",
  },
  {
    description: "Add page numbers, watermarks, custom backgrounds",
    icon: StampIcon,
    title: "Page Enhancements",
  },
  {
    description: "Search and replace text across the entire document",
    icon: SearchReplaceIcon,
    title: "Find & Replace",
  },
  {
    description: "Permanently hide sensitive info and lock form fields",
    icon: SecurityPasswordIcon,
    title: "Redact & Flatten",
  },
];

export function FeatureCards() {
  return (
    <section className="w-full py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-3xl font-semibold tracking-tight text-[var(--color-foreground)]">
          All the PDF tools you need
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-[var(--app-muted)]">
          A complete suite of PDF editing tools, right in your browser.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURE_CARDS.map((card) => (
            <Card key={card.title} className="gap-3 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--app-accent-subtle)]">
                <HugeiconsIcon
                  className="text-[var(--color-accent)]"
                  icon={card.icon}
                  size={20}
                />
              </div>
              <Card.Header className="gap-1 p-0">
                <Card.Title className="text-sm">{card.title}</Card.Title>
                <Card.Description className="text-xs">
                  {card.description}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
