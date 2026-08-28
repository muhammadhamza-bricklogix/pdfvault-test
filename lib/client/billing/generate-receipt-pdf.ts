import type { Invoice } from "@/lib/shared/types/billing.types";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import {
  FOOTER_COMPANY_ENTITY,
  FOOTER_PUBLIC_DOMAIN,
} from "@/lib/shared/constants/footer";
import { formatMinorAscii } from "@/lib/shared/utils/currency";

/**
 * PDFVault company address — matches the Privacy Policy / Subscription Terms
 * blocks so the receipt reads as an official document from the same legal
 * entity that operates the service.
 */
const COMPANY_ADDRESS_LINES = [
  "Dimostheni Severi 12, 6th floor, Flat/Office 601",
  "1080, Nicosia, Cyprus",
];

const LOGO_PATH = "/landing/logo-with-text.png";

const INVOICE_TYPE_LABELS: Record<Invoice["type"], string> = {
  TRIAL: "Trial subscription",
  RECURRING: "Monthly subscription — renewal",
  DOWNSELL: "Discounted plan",
  REFUND: "Refund",
  ONE_OFF: "One-off purchase",
};

const INVOICE_STATUS_LABELS: Record<Invoice["status"], string> = {
  APPROVED: "Paid",
  PENDING: "Pending",
  DECLINED: "Declined",
  REFUNDED: "Refunded",
};

export interface ReceiptContext {
  /** Signed-in user's primary email — printed under "Billed to". */
  customerEmail: string | null | undefined;
  /**
   * Optional plan name from the subscription snapshot (e.g. "Monthly").
   * Falls back to the invoice type label when absent.
   */
  planName?: string | null;
}

// Receipt PDF uses the shared ASCII money formatter so the currency
// code always shows ("USD 12.99" / "EUR 12.99" / …). pdf-lib's
// Helvetica is WinAnsi-encoded, and while WinAnsi does cover a
// handful of currency symbols (€, £, ¥, ¢), it doesn't cover ₹, ₽,
// ₩, ₺, etc. — writing the ISO code guarantees every user's
// receipt shows their purchased currency regardless of glyph
// coverage. HTML surfaces stick with the symbol variant.
const formatMoney = formatMinorAscii;

/**
 * pdf-lib's `StandardFonts.Helvetica*` are WinAnsi-encoded, so any glyph
 * outside that codepage (U+2192 →, U+2013 –, U+2014 —, U+2022 •, U+2026 …,
 * curly quotes, etc.) makes `drawText` throw. That killed "View receipt"
 * whenever a Solidgate plan label or invoice type description happened to
 * include a right-arrow / bullet / em-dash (QA report 2026-08-28).
 *
 * Rather than track down every runtime-injected string, sanitize every
 * label at the drawText boundary. Common typographic Unicode chars get
 * their nearest ASCII equivalent; anything else falls back to `?` so we
 * never throw. Keeps receipt generation resilient to future changes in
 * Solidgate's plan naming without an font-embed lift.
 */
const UNICODE_TO_ASCII: Array<[RegExp, string]> = [
  [/→/g, "->"],
  [/←/g, "<-"],
  [/↔/g, "<->"],
  [/↑/g, "^"],
  [/↓/g, "v"],
  [/—/g, "-"],
  [/–/g, "-"],
  [/•/g, "*"],
  [/…/g, "..."],
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/[ ]/g, " "],
];

function sanitizeForWinAnsi(text: string): string {
  let out = text;

  for (const [re, replacement] of UNICODE_TO_ASCII) {
    out = out.replace(re, replacement);
  }

  // Strip anything still outside the ASCII printable range so pdf-lib's
  // WinAnsi encoder can't throw on a stray glyph.
  return out.replace(/[^\x20-\x7E]/g, "?");
}

function formatDate(iso: string | null): string {
  const date = new Date(iso ?? Date.now());

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function loadLogoBytes(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(LOGO_PATH, { cache: "force-cache" });

    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();

    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

/**
 * Build a branded PDF receipt for a Solidgate invoice. Returns the raw
 * bytes so callers can decide whether to trigger a download (blob URL +
 * anchor click) or open the PDF in a new tab.
 *
 * Layout: single US Letter page. Logo top-left, "PAYMENT RECEIPT" top-right,
 * two side-by-side info blocks (invoice metadata + billed-to), single-line
 * item row with total, footer with legal entity and support contact.
 */
export async function generateReceiptPdf(
  invoice: Invoice,
  context: ReceiptContext,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter

  // Route every drawText call through the WinAnsi sanitizer so a stray
  // → / em-dash / bullet in a Solidgate plan label can never make
  // "View receipt" throw. Runs before pdf-lib's encoder — invisible to
  // the rest of this function.
  const originalDrawText = page.drawText.bind(page);

  page.drawText = ((text, options) =>
    originalDrawText(
      sanitizeForWinAnsi(String(text ?? "")),
      options,
    )) as typeof page.drawText;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 48;
  const contentWidth = 612 - marginX * 2;
  const textDark = rgb(0.07, 0.07, 0.07);
  const textMuted = rgb(0.4, 0.4, 0.4);
  const brand = rgb(0.94, 0.17, 0.14); // #F12C23
  const rule = rgb(0.88, 0.88, 0.88);

  // Logo (top-left) — best effort. If the fetch fails we substitute a
  // typeset "PDFVault" wordmark so the receipt still carries brand.
  const logoBytes = await loadLogoBytes();
  let logoBottomY = 720;

  if (logoBytes) {
    try {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoWidth = 140;
      const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

      page.drawImage(logoImage, {
        x: marginX,
        y: 792 - 60 - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
      logoBottomY = 792 - 60 - logoHeight;
    } catch {
      // Fall through to the wordmark below.
    }
  }

  if (!logoBytes) {
    page.drawText("PDFVault", {
      x: marginX,
      y: 730,
      size: 26,
      font: helveticaBold,
      color: brand,
    });
    logoBottomY = 726;
  }

  // "PAYMENT RECEIPT" — top-right block, right-aligned.
  const titleText = "PAYMENT RECEIPT";
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 20);

  page.drawText(titleText, {
    x: 612 - marginX - titleWidth,
    y: 736,
    size: 20,
    font: helveticaBold,
    color: textDark,
  });

  // Sub-label under the title.
  const subLabel = FOOTER_PUBLIC_DOMAIN;
  const subLabelWidth = helvetica.widthOfTextAtSize(subLabel, 10);

  page.drawText(subLabel, {
    x: 612 - marginX - subLabelWidth,
    y: 720,
    size: 10,
    font: helvetica,
    color: textMuted,
  });

  // Horizontal divider under the header.
  const dividerY = Math.min(logoBottomY, 712) - 16;

  page.drawLine({
    start: { x: marginX, y: dividerY },
    end: { x: 612 - marginX, y: dividerY },
    thickness: 0.6,
    color: rule,
  });

  // Two-column info block: invoice metadata (left) + billed to (right).
  const infoTop = dividerY - 28;
  const colWidth = contentWidth / 2 - 8;
  const rightColX = marginX + colWidth + 16;

  const drawLabelValue = (
    label: string,
    value: string,
    x: number,
    y: number,
  ) => {
    page.drawText(label.toUpperCase(), {
      x,
      y,
      size: 9,
      font: helveticaBold,
      color: textMuted,
    });
    page.drawText(value, {
      x,
      y: y - 14,
      size: 11,
      font: helvetica,
      color: textDark,
    });
  };

  const receiptNumber =
    invoice.invoiceNumber ?? invoice.id.slice(0, 8).toUpperCase();
  const paidDate = formatDate(invoice.paidAt ?? invoice.createdAt);

  drawLabelValue("Receipt number", receiptNumber, marginX, infoTop);
  drawLabelValue("Date issued", paidDate, marginX, infoTop - 38);
  drawLabelValue(
    "Status",
    INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status,
    marginX,
    infoTop - 76,
  );

  drawLabelValue(
    "Billed to",
    context.customerEmail ?? "Customer",
    rightColX,
    infoTop,
  );
  drawLabelValue("Issued by", FOOTER_COMPANY_ENTITY, rightColX, infoTop - 38);
  page.drawText(COMPANY_ADDRESS_LINES[0]!, {
    x: rightColX,
    y: infoTop - 66,
    size: 10,
    font: helvetica,
    color: textMuted,
  });
  page.drawText(COMPANY_ADDRESS_LINES[1]!, {
    x: rightColX,
    y: infoTop - 80,
    size: 10,
    font: helvetica,
    color: textMuted,
  });

  // Line item table header.
  const tableTop = infoTop - 130;

  page.drawRectangle({
    x: marginX,
    y: tableTop - 4,
    width: contentWidth,
    height: 26,
    color: rgb(0.97, 0.97, 0.97),
  });

  page.drawText("DESCRIPTION", {
    x: marginX + 12,
    y: tableTop + 4,
    size: 9,
    font: helveticaBold,
    color: textMuted,
  });
  page.drawText("AMOUNT", {
    x: 612 - marginX - 90,
    y: tableTop + 4,
    size: 9,
    font: helveticaBold,
    color: textMuted,
  });

  // Line item row.
  const rowY = tableTop - 32;
  const description = context.planName
    ? `${context.planName} — ${INVOICE_TYPE_LABELS[invoice.type] ?? invoice.type}`
    : (INVOICE_TYPE_LABELS[invoice.type] ?? invoice.type);
  const amount = formatMoney(invoice.amountMinor, invoice.currency);

  page.drawText(description, {
    x: marginX + 12,
    y: rowY,
    size: 11,
    font: helvetica,
    color: textDark,
  });
  page.drawText(amount, {
    x: 612 - marginX - 90,
    y: rowY,
    size: 11,
    font: helvetica,
    color: textDark,
  });

  page.drawLine({
    start: { x: marginX, y: rowY - 14 },
    end: { x: 612 - marginX, y: rowY - 14 },
    thickness: 0.5,
    color: rule,
  });

  // Total row.
  const totalY = rowY - 40;

  page.drawText("Total paid", {
    x: marginX + 12,
    y: totalY,
    size: 12,
    font: helveticaBold,
    color: textDark,
  });
  page.drawText(amount, {
    x: 612 - marginX - 90,
    y: totalY,
    size: 12,
    font: helveticaBold,
    color: brand,
  });

  // "Thanks" line above the footer.
  const thanksY = totalY - 60;

  page.drawText("Thank you for choosing PDFVault.", {
    x: marginX,
    y: thanksY,
    size: 11,
    font: helvetica,
    color: textDark,
  });
  page.drawText(
    "Questions about this receipt? Reach us at support@pdfvault.ai.",
    {
      x: marginX,
      y: thanksY - 16,
      size: 10,
      font: helvetica,
      color: textMuted,
    },
  );

  // Footer strip.
  const footerY = 60;

  page.drawLine({
    start: { x: marginX, y: footerY + 24 },
    end: { x: 612 - marginX, y: footerY + 24 },
    thickness: 0.5,
    color: rule,
  });

  page.drawText(
    `${FOOTER_COMPANY_ENTITY} • ${COMPANY_ADDRESS_LINES.join(", ")}`,
    {
      x: marginX,
      y: footerY + 8,
      size: 8,
      font: helvetica,
      color: textMuted,
    },
  );
  page.drawText(
    "Payments processed by Solidgate. This document is an electronic receipt of payment.",
    {
      x: marginX,
      y: footerY - 6,
      size: 8,
      font: helvetica,
      color: textMuted,
    },
  );

  return pdfDoc.save();
}

/**
 * Suggested filename for the download, formatted so the OS sort order
 * matches the paid-at date.
 */
export function receiptFileName(invoice: Invoice): string {
  const date = new Date(invoice.paidAt ?? invoice.createdAt);
  const iso = Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "receipt";

  return `PDFVault-receipt-${iso}-${invoice.invoiceNumber ?? invoice.id.slice(0, 8)}.pdf`;
}
