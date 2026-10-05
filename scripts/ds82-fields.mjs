/**
 * DS-82 field table — the authoring surface for the fillable template.
 *
 * The official DS-82 (eforms.state.gov, rev 04-2025) ships with an EMPTY
 * /Fields array: it is a print-and-write form. Every other form we support
 * (W-9, 1099-NEC, DS-11) arrives with AcroForm widgets, and the whole pipeline
 * — extract geometry -> build schema -> overlay -> client stamper -> backend
 * filler -> editable download — is built on filling widgets BY NAME. Rather than
 * fork that pipeline for one form, `build-ds82-template.mjs` injects the missing
 * widget layer once, and everything downstream proceeds exactly as it does for
 * DS-11.
 *
 * Geometry here is in PDF user space (origin bottom-left, 1-indexed pages), the
 * same convention as `FormFieldRect` in lib/shared/types/forms.types.ts, so the
 * numbers can be read straight out of `ds82-detect-boxes.mjs`.
 *
 * Names are human-readable on purpose, matching the DS-11 convention
 * ("Name of Applicant 2", "Book Status Lost") — they end up in the generated
 * schema, the backend field tables and the downloaded PDF, where a recipient
 * may well see them.
 *
 * `cells` marks a comb field: the printed box is divided into one cell per
 * character, so the widget needs the Comb flag and a matching /MaxLen.
 */

/** Pages 1-4 are instructions; the application is pages 5 and 6. */
export const APPLICATION_PAGES = [5, 6];

/**
 * A `choices` entry is ONE AcroForm field carrying one widget per option, each
 * with its own export value — the shape `selectWidget` in the client stamper
 * and the backend filler both expect, and what makes the options mutually
 * exclusive. Modelling these as separate checkbox fields would let a user tick
 * "Passport Book" and "Both" at the same time.
 *
 * DS-11 also has a second, worse flavour ("Book Status Lost" and friends: four
 * independent checkboxes that the schema calls a radio purely to impose
 * exclusivity) which exists only because Adobe authored that PDF badly. We are
 * authoring this one, so it has no DS-82 equivalent.
 */
export const FIELDS = [
  // ── Page 5 — document selection ────────────────────────────────────────
  {
    name: "Selection",
    type: "choices",
    page: 5,
    options: [
      { on: "Book", rect: { x: 87.5, y: 720, w: 9, h: 9.5 } },
      { on: "Card", rect: { x: 208, y: 720, w: 9, h: 9.5 } },
      { on: "Both", rect: { x: 331.5, y: 720.5, w: 9, h: 9 } },
    ],
  },
  {
    name: "Book Size",
    type: "choices",
    page: 5,
    options: [
      { on: "Regular", rect: { x: 106.5, y: 695.5, w: 8.5, h: 8.5 } },
      { on: "Large", rect: { x: 237, y: 695.5, w: 8.5, h: 8.5 } },
    ],
  },

  // ── Page 5 — 1. Name ───────────────────────────────────────────────────
  { name: "Last Name", page: 5, rect: { x: 70.5, y: 650, w: 321.5, h: 20 }, cells: 21 },
  { name: "First Name", page: 5, rect: { x: 70.5, y: 618, w: 260.5, h: 19.5 }, cells: 17 },
  { name: "Middle Name", page: 5, rect: { x: 337.5, y: 618, w: 245, h: 19.5 }, cells: 16 },

  // ── Page 5 — 2. Date of Birth / 3. Sex / 4. Place of Birth ─────────────
  { name: "DOB Month", page: 5, rect: { x: 70.5, y: 585, w: 30, h: 19.5 }, cells: 2 },
  { name: "DOB Day", page: 5, rect: { x: 104, y: 585, w: 30, h: 19.5 }, cells: 2 },
  { name: "DOB Year", page: 5, rect: { x: 138, y: 585, w: 61, h: 19.5 }, cells: 4 },
  {
    name: "Gender",
    type: "choices",
    page: 5,
    options: [
      { on: "M", rect: { x: 245.5, y: 585, w: 10.5, h: 10.5 } },
      { on: "F", rect: { x: 265.5, y: 585, w: 10, h: 10.5 } },
    ],
  },
  { name: "Place of Birth", page: 5, rect: { x: 322, y: 585, w: 260.5, h: 19.5 }, cells: 17 },

  // ── Page 5 — 5. SSN / 6. Email / 7. Phone ──────────────────────────────
  { name: "SSN 1", page: 5, rect: { x: 70.5, y: 551.5, w: 45.5, h: 19.5 }, cells: 3 },
  { name: "SSN 2", page: 5, rect: { x: 120.5, y: 551.5, w: 30, h: 19.5 }, cells: 2 },
  { name: "SSN 3", page: 5, rect: { x: 154.5, y: 551.5, w: 60.5, h: 19.5 }, cells: 4 },
  { name: "Email", page: 5, rect: { x: 222, y: 551.5, w: 196.5, h: 19 } },
  { name: "Primary Phone", page: 5, rect: { x: 426, y: 551.5, w: 156.5, h: 19.5 } },

  // ── Page 5 — 8. Mailing address ────────────────────────────────────────
  { name: "Mailing Address 1", page: 5, rect: { x: 26, y: 519.5, w: 552, h: 20 }, cells: 37 },
  { name: "Mailing Address 2", page: 5, rect: { x: 26, y: 488, w: 552, h: 20 }, cells: 37 },
  { name: "Mailing City", page: 5, rect: { x: 26, y: 457, w: 230, h: 19.5 }, cells: 15 },
  { name: "Mailing State", page: 5, rect: { x: 270, y: 457, w: 30, h: 19.5 }, cells: 2 },
  { name: "Mailing Zip", page: 5, rect: { x: 312.5, y: 457, w: 91.5, h: 19.5 }, cells: 6 },
  { name: "Mailing Country", page: 5, rect: { x: 414.5, y: 457, w: 168, h: 19.5 }, cells: 11 },

  // ── Page 5 — 9. Other names used ───────────────────────────────────────
  { name: "Other Name A", page: 5, rect: { x: 35, y: 424.5, w: 260.5, h: 19.5 }, cells: 17 },
  { name: "Other Name B", page: 5, rect: { x: 322, y: 424.5, w: 260.5, h: 19.5 }, cells: 17 },

  // ── Page 5 — 10. U.S. passport information ─────────────────────────────
  { name: "Passport Name", page: 5, rect: { x: 187.5, y: 378, w: 383.5, h: 19.5 }, cells: 25 },
  { name: "Book Number", page: 5, rect: { x: 187.5, y: 346.5, w: 260.5, h: 19.5 }, cells: 17 },
  { name: "Book Issue Date", page: 5, rect: { x: 458, y: 346.5, w: 122, h: 19.5 }, cells: 8 },
  { name: "Card Number", page: 5, rect: { x: 187.5, y: 315, w: 260.5, h: 19.5 }, cells: 17 },
  { name: "Card Issue Date", page: 5, rect: { x: 458, y: 315, w: 122, h: 19.5 }, cells: 8 },

  // ── Page 5 — 11. Name change information ───────────────────────────────
  {
    name: "Name Change Reason",
    type: "choices",
    page: 5,
    options: [
      { on: "Marriage", rect: { x: 188.5, y: 288, w: 6.5, h: 6.5 } },
      { on: "CourtOrder", rect: { x: 188.5, y: 274, w: 6.5, h: 7.5 } },
    ],
  },
  { name: "Name Change Place", page: 5, rect: { x: 280.5, y: 270.5, w: 168.5, h: 16.5 } },
  { name: "Name Change Date", page: 5, rect: { x: 457.5, y: 270.5, w: 117.5, h: 16.5 } },

  // ── Page 6 — mirrored header ───────────────────────────────────────────
  { name: "Name of Applicant 2", page: 6, rect: { x: 29, y: 736.5, w: 436, h: 17.5 } },
  { name: "Applicant DOB 2", page: 6, rect: { x: 472, y: 736.5, w: 109.5, h: 17.5 } },

  // ── Page 6 — 12-16 ─────────────────────────────────────────────────────
  { name: "Height", page: 6, rect: { x: 29, y: 698, w: 51.5, h: 17.5 } },
  { name: "Hair Color", page: 6, rect: { x: 85, y: 698, w: 94, h: 17.5 } },
  { name: "Eye Color", page: 6, rect: { x: 183.5, y: 698, w: 94.5, h: 17.5 } },
  { name: "Occupation", page: 6, rect: { x: 284.5, y: 698, w: 146.5, h: 17.5 } },
  { name: "Employer or School", page: 6, rect: { x: 442, y: 698, w: 138.5, h: 17.5 } },

  // ── Page 6 — 17. Additional contact phone numbers ──────────────────────
  // Each group prints a 2x2 grid of boxes — Home/Cell on the top row,
  // Work/Other below — where the fourth is unlabelled and followed by a ruled
  // line to write the type in. "Other" therefore sits in Cell's column on
  // Work's row, and the write-in field sits on the detected rule (y 658.7,
  // x 255.7-292.0 and 541.0-577.3).
  { name: "Additional Phone 1", page: 6, rect: { x: 29, y: 658, w: 170, h: 17.5 } },
  {
    name: "Additional Phone 1 Type",
    type: "choices",
    page: 6,
    options: [
      { on: "Home", rect: { x: 214, y: 669.5, w: 7, h: 7 } },
      { on: "Work", rect: { x: 214, y: 658.5, w: 7, h: 6.5 } },
      { on: "Cell", rect: { x: 246, y: 669, w: 7, h: 7.5 } },
      { on: "Other", rect: { x: 246, y: 658.5, w: 7, h: 6.5 } },
    ],
  },
  {
    name: "Additional Phone 1 Other",
    page: 6,
    rect: { x: 255.7, y: 659, w: 36.3, h: 10 },
  },
  { name: "Additional Phone 2", page: 6, rect: { x: 316.5, y: 658, w: 170, h: 17.5 } },
  {
    name: "Additional Phone 2 Type",
    type: "choices",
    page: 6,
    options: [
      { on: "Home", rect: { x: 490.5, y: 669, w: 7.5, h: 7.5 } },
      { on: "Work", rect: { x: 490.5, y: 658.5, w: 7.5, h: 7 } },
      { on: "Cell", rect: { x: 531, y: 669, w: 7, h: 7.5 } },
      { on: "Other", rect: { x: 531, y: 658.5, w: 7, h: 7 } },
    ],
  },
  {
    name: "Additional Phone 2 Other",
    page: 6,
    rect: { x: 541, y: 659, w: 36.3, h: 10 },
  },

  // ── Page 6 — 18. Permanent address ─────────────────────────────────────
  { name: "Permanent Street", page: 6, rect: { x: 29, y: 603.5, w: 467.5, h: 18 } },
  { name: "Permanent Apartment", page: 6, rect: { x: 503, y: 604, w: 79, h: 17.5 } },
  { name: "Permanent City", page: 6, rect: { x: 28.5, y: 571, w: 176.5, h: 17 } },
  // Unlike every other row on the form, the DS-82 prints State / Zip Code /
  // Country here as bare labels with NO entry box — only City is ruled. These
  // three are therefore positioned under their printed labels (at x 268.5 and
  // x 341 in the page's text layer) rather than snapped to a box.
  { name: "Permanent State", page: 6, rect: { x: 213, y: 571, w: 46, h: 17 } },
  { name: "Permanent Zip", page: 6, rect: { x: 266, y: 571, w: 68, h: 17 } },
  { name: "Permanent Country", page: 6, rect: { x: 339, y: 571, w: 150, h: 17 } },

  // ── Page 6 — 19. Emergency contact ─────────────────────────────────────
  { name: "Emergency Name", page: 6, rect: { x: 28, y: 518, w: 209, h: 16.5 } },
  { name: "Emergency Street", page: 6, rect: { x: 248, y: 518.5, w: 266.5, h: 16.5 } },
  { name: "Emergency Apartment", page: 6, rect: { x: 520.5, y: 517.5, w: 63.5, h: 16.5 } },
  { name: "Emergency City", page: 6, rect: { x: 30, y: 483.5, w: 118.5, h: 16.5 } },
  { name: "Emergency State", page: 6, rect: { x: 154.5, y: 483.5, w: 30, h: 16.5 } },
  { name: "Emergency Zip", page: 6, rect: { x: 189.5, y: 482, w: 50.5, h: 19.5 } },
  { name: "Emergency Country", page: 6, rect: { x: 247.5, y: 483.5, w: 153.5, h: 16.5 } },
  { name: "Emergency Email", page: 6, rect: { x: 409, y: 483, w: 173.5, h: 16.5 } },
  { name: "Emergency Phone", page: 6, rect: { x: 29, y: 448, w: 113, h: 16.5 } },
  { name: "Emergency Relationship", page: 6, rect: { x: 156.5, y: 448.5, w: 112, h: 16.5 } },

  // ── Page 6 — 20. Travel plans ──────────────────────────────────────────
  { name: "Departure Date", page: 6, rect: { x: 30, y: 388, w: 104, h: 17 } },
  { name: "Return Date", page: 6, rect: { x: 143.5, y: 389.5, w: 97.5, h: 16.5 } },
  { name: "Countries To Be Visited", page: 6, rect: { x: 246.5, y: 390, w: 339, h: 16.5 } },
];
