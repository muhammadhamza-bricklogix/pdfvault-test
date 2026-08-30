/**
 * Shared Mantine theme configuration for the documents table.
 * Brand red ramp matches CSS variable --pv-brand-red-* and the accent
 * swatch used by HeroUI throughout the app.
 */
export const BRAND_RED_PALETTE: [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] = [
  "#fef2f2",
  "#fde2e2",
  "#fbc6c5",
  "#f59896",
  "#ef6663",
  "#df3a38",
  "#c92a28",
  "#a4221f",
  "#7f1815",
  "#5a0e0c",
];

export const DOCUMENTS_TABLE_MANTINE_THEME = {
  colors: { brand: BRAND_RED_PALETTE },
  primaryColor: "brand",
  primaryShade: 5,
} as const;
