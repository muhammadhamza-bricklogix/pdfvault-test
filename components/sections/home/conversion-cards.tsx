import {
  ArchiveIcon,
  FileExportIcon,
  FileImportIcon,
  ImageDownloadIcon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card } from "@heroui/react";

const CONVERSION_CARDS = [
  {
    description: "High-fidelity PDF to/from Word, Excel, PowerPoint",
    icon: FileExportIcon,
    title: "Office Conversions",
  },
  {
    description: "Export as PDF, JPG, PNG, Word, Excel, PowerPoint",
    icon: FileImportIcon,
    title: "Multi-Format Export",
  },
  {
    description: "Extract all images from PDF in one click (as ZIP)",
    icon: ImageDownloadIcon,
    title: "Image Extractor",
  },
  {
    description:
      "Reduce file size with High / Balanced / Light / Custom quality options",
    icon: ArchiveIcon,
    title: "Smart Compression",
  },
  {
    description: "128-bit or 256-bit encryption — easy protect/unprotect",
    icon: LockPasswordIcon,
    title: "Password Protection",
  },
];

export function ConversionCards() {
  return (
    <section className="w-full py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-3xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Powerful PDF conversions
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-[var(--app-muted)]">
          Convert, compress, and protect your documents with enterprise-grade
          tools.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CONVERSION_CARDS.map((card) => (
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
