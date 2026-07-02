type SectionHeadingProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
};

/** Centered section heading + supporting copy, reused across landing sections. */
export function SectionHeading({ description, title }: SectionHeadingProps) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
      <h2 className="text-[clamp(28px,4vw,44px)] font-bold leading-tight tracking-[-0.03em] text-[var(--pv-text-primary)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--pv-text-secondary)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
