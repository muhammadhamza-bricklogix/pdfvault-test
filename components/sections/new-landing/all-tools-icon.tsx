import type {
  LandingToolIcon,
  LineIconId,
} from "@/lib/shared/constants/landing-tools";

/**
 * All-tools row icons. Renders one of two variants:
 *
 *   - `line`  : 18×18 stroke-1.5 outline icon in `currentColor` (dark text
 *               tone in the grid), matching the Figma EDIT & SIGN + OTHERS
 *               columns. Paths are inline (no /public asset fetch) so a
 *               row costs zero extra network requests.
 *   - `badge` : 20×24 rounded file-badge with a colored tab + monochrome
 *               body plus a small format label ("DOC", "PDF", …). Orange
 *               variant is used for "source → PDF" rows; blue variant is
 *               used for "PDF → target" rows.
 *
 * Adding a new line icon: append the `LineIconId` union in
 * `lib/shared/constants/landing-tools.ts`, then add the matching case here.
 */

interface Props {
  icon: LandingToolIcon;
}

export function AllToolsIcon({ icon }: Props) {
  if (icon.kind === "badge") {
    return <FileBadge label={icon.badge} variant={icon.variant} />;
  }

  return <LineIcon id={icon.id} />;
}

function LineIcon({ id }: { id: LineIconId }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 18,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.5,
    viewBox: "0 0 18 18",
    width: 18,
  };

  switch (id) {
    case "editor":
      return (
        <svg {...common}>
          <path d="M11.5 2.5H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
          <path d="M13.2 2.3a1.4 1.4 0 0 1 2 2L9 10.5l-2.5.6.6-2.5 6.1-6.3Z" />
        </svg>
      );
    case "compress":
      return (
        <svg {...common}>
          <path d="M2.5 6.5V3.5h3M15.5 6.5V3.5h-3M2.5 11.5v3h3M15.5 11.5v3h-3" />
          <path d="M6 9h6" />
        </svg>
      );
    case "organize":
      return (
        <svg {...common}>
          <rect height="8" rx="1.2" width="6" x="2.5" y="2.5" />
          <rect height="8" rx="1.2" width="6" x="9.5" y="7.5" />
        </svg>
      );
    case "split":
      return (
        <svg {...common}>
          <rect height="12" rx="1.4" width="8" x="5" y="3" />
          <path d="M9 3v12M2.5 6.5H5M2.5 11.5H5" />
        </svg>
      );
    case "password":
      return (
        <svg {...common}>
          <path d="M9 2.3c2.6.9 4.3 3.1 4.3 5.7v3.4c0 2.5-1.9 4.5-4.3 4.5s-4.3-2-4.3-4.5V8c0-2.6 1.7-4.8 4.3-5.7Z" />
          <path d="M9 8v3M9 12.4v.1" />
        </svg>
      );
    case "unlock":
      return (
        <svg {...common}>
          <rect height="8" rx="1.3" width="10" x="4" y="8.5" />
          <path d="M6 8.5V6a3 3 0 0 1 6 0" />
        </svg>
      );
    case "rotate":
      return (
        <svg {...common}>
          <path d="M14.5 8.5a5.5 5.5 0 1 1-1.7-4" />
          <path d="M14.5 3v3.5H11" />
        </svg>
      );
    case "delete":
      return (
        <svg {...common}>
          <path d="M3.5 5h11M6 5V3.5h6V5M5 5l.7 9.4a1.2 1.2 0 0 0 1.2 1.1h4.2a1.2 1.2 0 0 0 1.2-1.1L13 5" />
          <path d="M8 8v5M10 8v5" />
        </svg>
      );
    case "hash":
      return (
        <svg {...common}>
          <path d="M3 6.5h12M3 11.5h12M7 3l-1.5 12M12.5 3 11 15" />
        </svg>
      );
    case "extract-images":
      return (
        <svg {...common}>
          <rect height="11" rx="1.5" width="13" x="2.5" y="3.5" />
          <path d="M2.5 12l4-4 3 3 2-2 4 4" />
          <circle cx="6.2" cy="7" r="1" />
        </svg>
      );
    case "crop":
      return (
        <svg {...common}>
          <path d="M4.5 2v10a1.5 1.5 0 0 0 1.5 1.5h10" />
          <path d="M2 4.5h10A1.5 1.5 0 0 1 13.5 6v10" />
        </svg>
      );
    case "ocr":
      return (
        <svg {...common}>
          <path d="M3 5.5V4a1.5 1.5 0 0 1 1.5-1.5H6M15 5.5V4a1.5 1.5 0 0 0-1.5-1.5H12M3 12.5V14a1.5 1.5 0 0 0 1.5 1.5H6M15 12.5V14a1.5 1.5 0 0 1-1.5 1.5H12" />
          <path d="M5.5 9h7" />
        </svg>
      );
    case "remove-annotations":
      return (
        <svg {...common}>
          <path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h10a1.5 1.5 0 0 1 1.5 1.5V11a1.5 1.5 0 0 1-1.5 1.5h-3L8 15.5V12.5H4A1.5 1.5 0 0 1 2.5 11V4.5Z" />
          <path d="M6.5 6.5l5 3M11.5 6.5l-5 3" />
        </svg>
      );
    case "repair":
      return (
        <svg {...common}>
          <path d="M14 3.5a3 3 0 0 0-4 3.7l-6.4 6.4a1.5 1.5 0 0 0 2 2L12 9.2A3 3 0 0 0 15.5 5l-1.7 1.7-1.6-.4-.4-1.6L13.6 3Z" />
        </svg>
      );
    case "bookmarks":
      return (
        <svg {...common}>
          <path d="M4.5 3h9v12l-4.5-3-4.5 3V3Z" />
        </svg>
      );
    case "watermark":
      return (
        <svg {...common}>
          <path d="M4 2.5h7l3.5 3.5V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
          <path d="M11 2.5V6h3.5" />
          <path d="M5.5 12.5h7M5.5 10h5" />
        </svg>
      );
    default:
      return null;
  }
}

interface BadgeProps {
  variant: "orange" | "blue";
  label: string;
}

/**
 * Small file badge (~20×24) matching Figma. The "tab" corner is baked into
 * the shape so it reads as a document even at 18px. Label is centered in
 * the lower body; whatever string is passed just draws — callers control
 * length (e.g. "DOC", "PDF", "XLS", "ANY").
 */
function FileBadge({ variant, label }: BadgeProps) {
  const fill = variant === "blue" ? "#2563EB" : "#F97316";
  const softFill = variant === "blue" ? "#DBEAFE" : "#FFEDD5";

  return (
    <svg
      aria-hidden
      fill="none"
      height="20"
      viewBox="0 0 20 24"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 3a2 2 0 0 1 2-2h9l5 5v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3Z"
        fill={softFill}
      />
      <path d="M13 1v3a2 2 0 0 0 2 2h3" fill={fill} opacity="0.85" />
      <rect fill={fill} height="6" rx="1" width="14" x="3" y="12" />
      <text
        fill="#ffffff"
        fontFamily="Geist, system-ui, sans-serif"
        fontSize="4.6"
        fontWeight="700"
        textAnchor="middle"
        x="10"
        y="16.1"
      >
        {label}
      </text>
    </svg>
  );
}
