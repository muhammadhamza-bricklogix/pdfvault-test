const RIGHTS: { body: string; title: string }[] = [
  {
    body: "Request a copy of the personal data we hold about you.",
    title: "Access",
  },
  {
    body: "Correct inaccurate or incomplete data.",
    title: "Rectification",
  },
  {
    body: 'Request deletion of your personal data ("right to be forgotten").',
    title: "Erasure",
  },
  {
    body: "Request that we limit how we process your data.",
    title: "Restriction",
  },
  {
    body: "Receive your data in a machine-readable format.",
    title: "Portability",
  },
  {
    body: "Object to processing based on legitimate interests.",
    title: "Object",
  },
  {
    body: "For processing based on consent, at any time.",
    title: "Withdraw consent",
  },
  {
    body: "With your local data protection authority.",
    title: "Lodge a complaint",
  },
];

export function LegalRightsGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {RIGHTS.map((item) => (
        <div
          key={item.title}
          className="rounded-xl border border-[var(--legal-border-subtle)] bg-[var(--legal-pink-header)] p-4 text-sm"
        >
          <p className="font-semibold text-[var(--legal-burgundy)]">
            {item.title}
          </p>
          <p className="mt-2 leading-relaxed text-[var(--legal-text-body)]">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}
