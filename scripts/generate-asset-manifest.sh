#!/bin/bash
# Generate asset-manifest.json from homemapdata.example directory

cd "$(dirname "$0")/.." || exit 1

OUTPUT="homemapdata.example/asset-manifest.json"

echo "Generating asset manifest..."

# Create JSON array of all files
echo "{" > "$OUTPUT"
echo '  "version": "1.0.0",' >> "$OUTPUT"
echo '  "files": [' >> "$OUTPUT"

find homemapdata.example -type f -not -path "*/asset-manifest.json" -not -name ".DS_Store" -not -name ".gitkeep" | \
  sed 's|^homemapdata.example/||' | \
  sed 's/.*/"&"/' | \
  paste -sd, - | \
  sed 's/,/,\n    /g' | \
  sed 's/^/    /' >> "$OUTPUT"

echo '' >> "$OUTPUT"
echo '  ]' >> "$OUTPUT"
echo '}' >> "$OUTPUT"

FILE_COUNT=$(grep -o '"' "$OUTPUT" | wc -l)
FILE_COUNT=$((FILE_COUNT / 2))
echo "Created $OUTPUT with $FILE_COUNT files"
