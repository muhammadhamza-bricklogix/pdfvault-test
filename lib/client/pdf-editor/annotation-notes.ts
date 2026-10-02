import type { FabricObject } from "fabric";

// Sticky-note marker icons (the standard PDF note icon set), drawn in a
// 24×24 box: `body` is filled with the note colour, `detail` is stroked only.
export type NoteIconId =
  | "comment"
  | "note"
  | "help"
  | "check"
  | "cross"
  | "star"
  | "circle"
  | "insert"
  | "key"
  | "newParagraph"
  | "paragraph"
  | "rightArrow"
  | "rightPointer"
  | "upArrow"
  | "upLeftArrow";

export type NoteIconDef = {
  body: string;
  detail?: string;
  id: NoteIconId;
  label: string;
};

const ROUNDED_SQUARE =
  "M4 1H20C21.7 1 23 2.3 23 4V20C23 21.7 21.7 23 20 23H4C2.3 23 1 21.7 1 20V4C1 2.3 2.3 1 4 1Z";

export const NOTE_ICONS: ReadonlyArray<NoteIconDef> = [
  {
    id: "comment",
    label: "Comment",
    body: "M3 1H21C22.1 1 23 1.9 23 3V16C23 17.1 22.1 18 21 18H13L5 23V18H3C1.9 18 1 17.1 1 16V3C1 1.9 1.9 1 3 1Z",
    detail: "M6 7H18M6 11.5H14",
  },
  {
    id: "note",
    label: "Note",
    body: "M4 1H15L21 7V22C21 22.6 20.6 23 20 23H4C3.4 23 3 22.6 3 22V2C3 1.4 3.4 1 4 1Z",
    detail: "M15 1V7H21M7 12H17M7 16H17M7 19.5H13",
  },
  {
    id: "help",
    label: "Help",
    body: "M12 1A11 11 0 1 1 11.99 1Z",
    detail:
      "M8.8 9A3.3 3.3 0 0 1 15.2 9.6C15.2 11.8 12 12.3 12 14.6M12 17.4V18.6",
  },
  {
    id: "check",
    label: "Check",
    body: "M1.5 13L5 9.5L9.5 14L19 3.5L22.5 7L9.5 21Z",
  },
  {
    id: "cross",
    label: "Cross",
    body: "M5 1.5L12 8.5L19 1.5L22.5 5L15.5 12L22.5 19L19 22.5L12 15.5L5 22.5L1.5 19L8.5 12L1.5 5Z",
  },
  {
    id: "star",
    label: "Star",
    body: "M12 1L15.1 8.3L23 8.9L17 14.1L18.8 21.9L12 17.8L5.2 21.9L7 14.1L1 8.9L8.9 8.3Z",
  },
  {
    id: "circle",
    label: "Circle",
    body: "M12 1.5A10.5 10.5 0 1 1 11.99 1.5Z",
  },
  {
    id: "insert",
    label: "Insert",
    body: "M12 2L22.5 21.5H17.5L12 11.5L6.5 21.5H1.5Z",
  },
  {
    id: "key",
    label: "Key",
    body: "M7.5 6.5A5.5 5.5 0 0 1 12.7 10.5H22.5V13.5H21V16.5H18.5V13.5H17V15.5H14.5V13.5H12.7A5.5 5.5 0 1 1 7.5 6.5Z",
    detail: "M7.5 10.5A1.5 1.5 0 1 0 7.51 10.5Z",
  },
  {
    id: "newParagraph",
    label: "New paragraph",
    body: ROUNDED_SQUARE,
    detail: "M5 17V7L10.5 17V7M14 17V7H16.5A2.5 2.5 0 0 1 16.5 12H14",
  },
  {
    id: "paragraph",
    label: "Paragraph",
    body: ROUNDED_SQUARE,
    detail: "M16 5V19M12.5 5V19M16 5H10.5A3.5 3.5 0 0 0 10.5 12H12.5",
  },
  {
    id: "rightArrow",
    label: "Right arrow",
    body: "M1 8.5H12.5V3L23 12L12.5 21V15.5H1Z",
  },
  {
    id: "rightPointer",
    label: "Right pointer",
    body: "M2 2.5L22.5 12L2 21.5L7 12Z",
  },
  {
    id: "upArrow",
    label: "Up arrow",
    body: "M12 1L21 11.5H15.5V23H8.5V11.5H3Z",
  },
  {
    id: "upLeftArrow",
    label: "Up-left arrow",
    body: "M2 2H15L10.5 6.5L22 18L18 22L6.5 10.5L2 15Z",
  },
];

export type NoteColorDef = { label: string; value: string };

export const NOTE_COLORS: ReadonlyArray<NoteColorDef> = [
  { label: "Yellow", value: "#FFD633" },
  { label: "Orange", value: "#FFA94D" },
  { label: "Red", value: "#FF6B6B" },
  { label: "Pink", value: "#F783AC" },
  { label: "Purple", value: "#B197FC" },
  { label: "Blue", value: "#74C0FC" },
  { label: "Green", value: "#69DB7C" },
  { label: "Gray", value: "#CED4DA" },
];

export const DEFAULT_NOTE_ICON: NoteIconId = "comment";
export const DEFAULT_NOTE_COLOR = NOTE_COLORS[0].value;
export const NOTE_MARKER_SIZE = 24;

const DETAIL_STROKE = "#1F2937";

export type NoteFabricObject = FabricObject & {
  annotationKind?: string;
  editorType?: string;
  noteColor?: string;
  noteIcon?: NoteIconId;
  noteText?: string;
};

export function getNoteIconDef(id: string | undefined): NoteIconDef {
  return NOTE_ICONS.find((icon) => icon.id === id) ?? NOTE_ICONS[0];
}

export function isNoteColor(value: string): boolean {
  return NOTE_COLORS.some((color) => color.value === value);
}

/** Darker shade of a #RRGGBB colour, used for the marker outline. */
export function darkenHex(hex: string, amount = 0.32): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!match) return "#7A6200";
  const n = parseInt(match[1], 16);
  const channel = (shift: number) =>
    Math.round(((n >> shift) & 0xff) * (1 - amount))
      .toString(16)
      .padStart(2, "0");

  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Icon id of a note marker; markers saved before icons existed are comments. */
export function getNoteIcon(obj: NoteFabricObject): NoteIconId {
  return getNoteIconDef(obj.noteIcon).id;
}

/** Fill colour of a note marker, including markers saved as a single path. */
export function getNoteColor(obj: NoteFabricObject): string {
  if (typeof obj.noteColor === "string") return obj.noteColor;
  const fill = obj.type === "group" ? undefined : obj.fill;

  return typeof fill === "string" ? fill : DEFAULT_NOTE_COLOR;
}

type FabricModule = typeof import("fabric");

export function buildNoteMarker(
  fabric: Pick<FabricModule, "Group" | "Path">,
  opts: {
    color: string;
    icon: NoteIconId;
    left: number;
    noteText?: string;
    top: number;
  },
): NoteFabricObject {
  const def = getNoteIconDef(opts.icon);
  const outline = darkenHex(opts.color);
  const body = new fabric.Path(def.body, {
    fill: opts.color,
    objectCaching: false,
    stroke: outline,
    strokeLineJoin: "round",
    strokeWidth: 1,
  });
  const parts: FabricObject[] = [body];

  if (def.detail) {
    parts.push(
      new fabric.Path(def.detail, {
        fill: "",
        objectCaching: false,
        stroke: DETAIL_STROKE,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeWidth: 1.6,
      }),
    );
  }

  const group = new fabric.Group(parts, {
    left: opts.left,
    objectCaching: false,
    originX: "left",
    originY: "top",
    top: opts.top,
  }) as NoteFabricObject;

  group.set({
    annotationKind: "sticky-note",
    editorType: "annotation",
    noteColor: opts.color,
    noteIcon: def.id,
    noteText: opts.noteText ?? "",
  } as Partial<NoteFabricObject>);

  return group;
}

/** Recolour a note marker in place (grouped markers and legacy paths). */
export function applyNoteColor(obj: NoteFabricObject, color: string): void {
  const outline = darkenHex(color);

  if (obj.type === "group") {
    const body = (
      obj as unknown as { getObjects?: () => FabricObject[] }
    ).getObjects?.()[0];

    body?.set({ fill: color, stroke: outline });
  } else {
    obj.set({ fill: color, stroke: outline });
  }
  obj.set({ noteColor: color } as Partial<NoteFabricObject>);
  obj.set("dirty", true);
}
