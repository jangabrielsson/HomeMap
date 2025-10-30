#!/bin/bash

# create-package.sh - Create a HomeMap Widget Package (.hwp file)
# Usage: ./scripts/create-package.sh [package-id] [output-dir]

set -e

PACKAGE_ID=$1
OUTPUT_DIR=${2:-.}

if [ -z "$PACKAGE_ID" ]; then
    echo "Usage: ./scripts/create-package.sh <package-id> [output-dir]"
    echo ""
    echo "Example:"
    echo "  ./scripts/create-package.sh com.jangabrielsson.gauge ~/Desktop"
    echo ""
    echo "Available packages:"
    if [ -d "homemapdata/widgets/packages" ]; then
        ls -1 homemapdata/widgets/packages/
    else
        echo "  No packages found in homemapdata/widgets/packages/"
    fi
    exit 1
fi

HOMEMAP_DATA="homemapdata"

# Check if package exists
PACKAGE_DIR="$HOMEMAP_DATA/widgets/packages/$PACKAGE_ID"
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "Error: Package not found: $PACKAGE_ID"
    echo "Package directory does not exist: $PACKAGE_DIR"
    exit 1
fi

# Check if manifest exists
MANIFEST="$PACKAGE_DIR/manifest.json"
if [ ! -f "$MANIFEST" ]; then
    echo "Error: No manifest.json found in $PACKAGE_DIR"
    exit 1
fi

echo "Creating package for: $PACKAGE_ID"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Temp directory: $TEMP_DIR"

# Copy manifest
echo "Copying manifest..."
cp "$MANIFEST" "$TEMP_DIR/"

# Read package info from manifest
PACKAGE_NAME=$(cat "$MANIFEST" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"name"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
VERSION=$(cat "$MANIFEST" | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"version"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')

echo "Package: $PACKAGE_NAME v$VERSION"

# Copy widgets
echo "Copying widgets..."
WIDGETS_COUNT=0
if ls "$PACKAGE_DIR"/*.json >/dev/null 2>&1; then
    mkdir -p "$TEMP_DIR/widgets"
    for widget in "$PACKAGE_DIR"/*.json; do
        if [ "$(basename "$widget")" != "manifest.json" ]; then
            cp "$widget" "$TEMP_DIR/widgets/"
            WIDGETS_COUNT=$((WIDGETS_COUNT + 1))
        fi
    done
fi
echo "  $WIDGETS_COUNT widget(s) copied"

# Copy icons
ICONS_PACKAGE_DIR="$HOMEMAP_DATA/icons/packages/$PACKAGE_ID"
ICONS_COUNT=0
if [ -d "$ICONS_PACKAGE_DIR" ]; then
    echo "Copying icon sets..."
    mkdir -p "$TEMP_DIR/icons"
    for iconset in "$ICONS_PACKAGE_DIR"/*; do
        if [ -d "$iconset" ]; then
            iconset_name=$(basename "$iconset")
            cp -r "$iconset" "$TEMP_DIR/icons/"
            ICONS_COUNT=$((ICONS_COUNT + 1))
            echo "  - $iconset_name"
        fi
    done
    echo "  $ICONS_COUNT icon set(s) copied"
else
    echo "No icon sets found for this package"
fi

# Check for README
README="$PACKAGE_DIR/README.md"
if [ -f "$README" ]; then
    echo "Copying README.md..."
    cp "$README" "$TEMP_DIR/"
fi

# Check for screenshots
SCREENSHOTS_DIR="$PACKAGE_DIR/screenshots"
if [ -d "$SCREENSHOTS_DIR" ]; then
    echo "Copying screenshots..."
    cp -r "$SCREENSHOTS_DIR" "$TEMP_DIR/"
fi

# Create output filename
PACKAGE_FILE_NAME=$(echo "$PACKAGE_ID" | sed 's/\./-/g')
OUTPUT_FILE="$OUTPUT_DIR/${PACKAGE_FILE_NAME}-${VERSION}.hwp"

# Create ZIP package
echo "Creating package file: $OUTPUT_FILE"
cd "$TEMP_DIR"
zip -r "$OUTPUT_FILE" . -q

# Show package contents
echo ""
echo "Package created successfully!"
echo "File: $OUTPUT_FILE"
echo "Size: $(ls -lh "$OUTPUT_FILE" | awk '{print $5}')"
echo ""
echo "Package contents:"
unzip -l "$OUTPUT_FILE"

cd - > /dev/null

echo ""
echo "✅ Done!"
