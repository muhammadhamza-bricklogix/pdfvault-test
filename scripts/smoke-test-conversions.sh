#!/usr/bin/env bash
# Smoke-test the conversion backend across 7 format families.
# Run with: bash scripts/smoke-test-conversions.sh
# Expects backend at http://localhost:7403 with /conversion endpoint.

set -uo pipefail

BACKEND="${BACKEND:-http://localhost:7403}"
SAMPLE_PDF="${SAMPLE_PDF:-$HOME/Downloads/sample-local-pdf.pdf}"
SAMPLE_DOCX="${SAMPLE_DOCX:-$HOME/Downloads/Invoice_PDF_Editor_Project.docx}"
SAMPLE_JPG="${SAMPLE_JPG:-$HOME/Downloads/IMG_1120.JPG}"
OUT_DIR="${OUT_DIR:-/tmp/conversion-smoke}"

mkdir -p "$OUT_DIR"

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
blue()  { printf "\033[34m%s\033[0m\n" "$1"; }

# Pre-flight: backend reachable?
if ! curl -fsS -o /dev/null --max-time 5 "$BACKEND/api/docs"; then
  red "Backend not reachable at $BACKEND. Start it first:"
  echo "  cd ~/Downloads/pdf-viewer-backend-main && npm run start:dev"
  exit 1
fi

# Pre-flight: sample files exist?
for f in "$SAMPLE_PDF" "$SAMPLE_DOCX" "$SAMPLE_JPG"; do
  if [ ! -f "$f" ]; then
    red "Sample file missing: $f"
    exit 1
  fi
done

declare -a TESTS=(
  "raster       | $SAMPLE_PDF  | pdf_to_jpg   | jpg"
  "vector       | $SAMPLE_PDF  | pdf_to_svg   | svg"
  "office-out   | $SAMPLE_PDF  | pdf_to_docx  | docx"
  "ebook        | $SAMPLE_PDF  | pdf_to_epub  | epub"
  "text         | $SAMPLE_PDF  | pdf_to_txt   | txt"
  "office-in    | $SAMPLE_DOCX | docx_to_pdf  | pdf"
  "image-in     | $SAMPLE_JPG  | jpg_to_pdf   | pdf"
)

PASS=0
FAIL=0

for spec in "${TESTS[@]}"; do
  IFS='|' read -r family input type expected_ext <<<"$spec"
  family=$(echo "$family" | xargs)
  input=$(echo "$input" | xargs)
  type=$(echo "$type" | xargs)
  expected_ext=$(echo "$expected_ext" | xargs)

  blue "→ [$family] $type"
  out_file="$OUT_DIR/${type}.${expected_ext}"

  http_code=$(curl -sS -o "$out_file" -w "%{http_code}" \
    -F "file=@${input}" -F "type=${type}" \
    "$BACKEND/conversion" 2>&1) || true

  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]] && [ -s "$out_file" ]; then
    bytes=$(stat -f%z "$out_file" 2>/dev/null || stat -c%s "$out_file")
    head_bytes=$(head -c 8 "$out_file" | xxd -p)
    green "  ✓ $type → $out_file ($bytes bytes, magic: $head_bytes)"
    PASS=$((PASS+1))
  else
    red "  ✗ $type failed (HTTP $http_code)"
    red "    Body: $(head -c 300 "$out_file")"
    FAIL=$((FAIL+1))
  fi
done

echo
echo "=== Summary: $PASS passed, $FAIL failed ==="
echo "Outputs in $OUT_DIR/"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
