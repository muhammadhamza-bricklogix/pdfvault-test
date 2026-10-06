import Link from "next/link";
import {
  CloudUploadIcon,
  GiftIcon,
  InfinityIcon,
  SquareLock01Icon,
  PencilEdit01Icon,
  Pdf01Icon,
  RefreshIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { LocaleText } from "@/components/shared/i18n/locale-text";
import { ROUTES } from "@/lib/shared/constants/routes";

const ShieldIcon = Shield01Icon;

const PILLARS = [
  {
    icon: SquareLock01Icon,
    title: "Privacy by design",
    body: "Uploaded files are processed in memory, not stored, unless you choose to save them.",
  },
  {
    icon: GiftIcon,
    title: "Free core tools",
    body: "Merge, split, compress, convert, rotate, unlock, and watermark — no account required.",
  },
  {
    icon: InfinityIcon,
    title: "Built to last",
    body: "A toolkit that keeps growing, shaped by feedback from the people who use it.",
  },
] as const;

const TOOLS = [
  {
    icon: PencilEdit01Icon,
    title: "Edit & Sign",
    body: "Mark up, fill in, and sign documents right in your browser.",
  },
  {
    icon: CloudUploadIcon,
    title: "Convert to PDF",
    // Excel/PowerPoint hidden 2026-08-28 pending pipeline work.
    body: "Turn Word documents, images, and more into clean PDFs.",
  },
  {
    icon: RefreshIcon,
    title: "Compress",
    body: "Shrink file size without losing document quality.",
  },
  {
    icon: Pdf01Icon,
    title: "Convert from PDF",
    body: "Export PDFs back to editable Word documents or image files.",
  },
] as const;

const STEPS = [
  {
    n: 1,
    title: "Bring in your document",
    body: "Upload from your device, or import directly from Google Drive or Microsoft OneDrive.",
  },
  {
    n: 2,
    title: "Make it yours",
    body: "Edit, convert, compress, protect, organize, or sign it with the tools you need.",
  },
  {
    n: 3,
    title: "Save it to your vault",
    body: "Keep the latest version in your personal document library, ready whenever you need it again.",
  },
] as const;

const TRUST_TAGS = [
  "TLS Encrypted",
  "Hashed Passwords",
  "GDPR Aligned",
  "We Never Sell Your Data",
] as const;

export function AboutUsContent() {
  return (
    <div className="space-y-16">
      {/* Intro */}
      <section>
        <p className="text-[15px] leading-relaxed text-[var(--pv-text-body)]">
          PDFVault is the all-in-one workspace for everyday document work —
          built by{" "}
          <strong>FLUTTWINGS INVESTMENTS LIMITED, Nicosia, Cyprus</strong> to
          take the friction out of editing, converting, and protecting your
          files.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--pv-text-body)]">
          Documents shouldn&apos;t be complicated. PDFVault brings the tools
          people need for everyday document work — converting, editing, signing,
          compressing, and everything in between — into one easy-to-use website.
          No downloads, no steep learning curve, no unnecessary steps between
          you and the file you need.
        </p>
        {/* QA DE: Weglot auto-translation produced "behandeln wir jede
            Datei … – sie werden …" (singular "jede Datei" paired with
            plural "sie werden" — grammatical mismatch). Hand-DE
            override normalises both halves to plural ("alle Dateien" +
            "sie werden") so the subject + verb agree on /de/*. */}
        <LocaleText
          as="p"
          className="mt-4 text-[15px] leading-relaxed text-[var(--pv-text-body)]"
          de={
            <>
              Wir bauen und verfeinern unser Toolkit kontinuierlich auf Basis
              dessen, was unsere Nutzer tatsächlich brauchen, und behandeln wir
              alle Dateien mit derselben Sorgfalt, die wir für unsere eigenen
              wünschen würden — sie werden im Arbeitsspeicher verarbeitet, nie
              gelesen und nie verkauft.
            </>
          }
        >
          We&apos;re continually building and refining the toolkit based on what
          our users actually need, and we handle every file with the same care
          we&apos;d want for our own — processed in memory, never read, and
          never sold.
        </LocaleText>
      </section>

      {/* Pillars */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-[var(--pv-hairline)] bg-[var(--pv-surface)] p-5 text-left"
            >
              <div className="flex flex-col items-start gap-3">
                {/* `color-mix` instead of Tailwind's `bg-[var(--…)]/10`
                    modifier — Edge (and older Chromium) can't compute
                    the alpha on a CSS variable at build time, so the
                    tinted backdrop disappears and the icon reads as a
                    lone outline floating next to the heading (QA
                    2026-09-12). Matches the Tools grid below.
                    Icon-above-title stack (QA 2026-09-15) so
                    `Privacy by design` doesn't wrap into the icon and
                    read as "touching the icon bottom" at the 3-col
                    breakpoint. */}
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,#f12c23_12%,transparent)] text-[#f12c23]">
                  <HugeiconsIcon icon={p.icon} size={22} strokeWidth={1.8} />
                </span>
                <h3 className="text-[16px] font-semibold leading-tight text-[var(--pv-text-strong)]">
                  {p.title}
                </h3>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--pv-text-body)]">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* What we offer */}
      <section>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--pv-brand-red)]">
          What we offer
        </p>
        <h2 className="mt-2 text-[28px] font-bold leading-tight text-[var(--pv-text-strong)] sm:text-[32px]">
          Every tool you need for PDFs, in one place.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--pv-text-body)]">
          All of our core tools are 100% free and easy to use — get to your
          result in just a few clicks.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <div
              key={t.title}
              className="group rounded-2xl border border-[var(--pv-border-subtle,#dee2e6)] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,#f12c23_35%,transparent)] hover:shadow-[0_10px_28px_-18px_rgba(241,44,35,0.35)]"
            >
              <div className="flex flex-col items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,#f12c23_12%,transparent)] text-[#f12c23] transition-colors group-hover:bg-[color-mix(in_srgb,#f12c23_18%,transparent)]">
                  <HugeiconsIcon icon={t.icon} size={22} strokeWidth={1.8} />
                </span>
                <h3 className="text-[16px] font-semibold leading-tight text-[#121212]">
                  {t.title}
                </h3>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--pv-text-secondary,#5f5f5f)]">
                {t.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[13px] italic text-[var(--pv-text-muted)]">
          …and more, with new tools added regularly.
        </p>
      </section>

      {/* How it works */}
      <section>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--pv-brand-red)]">
          How it works
        </p>
        <h2 className="mt-2 text-[28px] font-bold leading-tight text-[var(--pv-text-strong)] sm:text-[32px]">
          From upload to done, in three steps.
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-[var(--pv-hairline)] bg-[var(--pv-surface)] p-5"
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pv-brand-red,#f12c23)] text-[16px] font-bold text-white">
                {s.n}
              </span>
              <h3 className="text-[16px] font-semibold text-[var(--pv-text-strong)]">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--pv-text-body)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust and security */}
      <section>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--pv-brand-red)]">
          Trust and security
        </p>
        <h2 className="mt-2 text-[28px] font-bold leading-tight text-[var(--pv-text-strong)] sm:text-[32px]">
          Protecting your files, every step of the way.
        </h2>
        <LocaleText
          as="p"
          className="mt-3 text-[15px] leading-relaxed text-[var(--pv-text-body)]"
          de={
            <>
              Wir verwenden branchenübliche Sicherheitsmaßnahmen, einschließlich
              TLS-Verschlüsselung bei der Übertragung und gehashte Passwörter,
              und wir verkaufen Ihre persönlichen Daten niemals. Die Inhalte
              Ihrer hochgeladenen Dateien werden nie erfasst — sie werden im
              Arbeitsspeicher verarbeitet und gelöscht, sobald Ihre Sitzung
              endet, es sei denn, Sie entscheiden sich, sie in Ihrem Konto zu
              speichern.
            </>
          }
        >
          We use industry-standard security measures, including TLS encryption
          in transit and hashed passwords, and we never sell your personal data.
          The contents of your uploaded files are never collected — they&apos;re
          processed in memory and cleared once your session ends, unless you
          choose to save them to your account.
        </LocaleText>
        <div className="mt-5 flex flex-wrap gap-2">
          {TRUST_TAGS.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--pv-hairline)] bg-[var(--pv-surface)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--pv-text-strong)]"
            >
              <HugeiconsIcon icon={ShieldIcon} size={14} />
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Get started */}
      <section className="rounded-2xl border border-[var(--pv-hairline)] bg-[var(--pv-brand-red)]/5 p-8 text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--pv-brand-red)]">
          Get started
        </p>
        <h2 className="mt-2 text-[26px] font-bold leading-tight text-[var(--pv-text-strong)] sm:text-[30px]">
          Manage all your documents in one place.
        </h2>
        <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-relaxed text-[var(--pv-text-body)]">
          No downloads. No learning curve. Just the tools you need, right when
          you need them.
        </p>
        <Link
          className="mt-5 inline-flex h-12 items-center justify-center rounded-full border border-[var(--pv-brand-red)] bg-[var(--pv-brand-red)] px-8 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--pv-brand-red-dark,#d21f17)] hover:border-[var(--pv-brand-red-dark,#d21f17)] hover:text-white"
          href={ROUTES.PUBLIC.HOME}
        >
          Start Now
        </Link>
      </section>
    </div>
  );
}
