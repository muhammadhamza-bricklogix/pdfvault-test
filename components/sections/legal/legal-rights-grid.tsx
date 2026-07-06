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
    <ul className="mt-2 space-y-2 pl-5" style={{ listStyle: "disc" }}>
      {RIGHTS.map((item) => (
        <li key={item.title}>
          <strong>{item.title}</strong> — {item.body}
        </li>
      ))}
    </ul>
  );
}
