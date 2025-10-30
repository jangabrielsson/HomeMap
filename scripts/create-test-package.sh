#!/bin/bash
# create-test-package.sh - Create a test .hwp package from gauge widget

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOMEMAP_DATA="${PROJECT_ROOT}/homemapdata"

# Package details
PACKAGE_ID="com.jangabrielsson.gauge"
PACKAGE_NAME="gauge-widget"
VERSION="1.0.0"

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "Creating package in: $TEMP_DIR"

# Create manifest.json
cat > "$TEMP_DIR/manifest.json" <<EOF
{
  "id": "${PACKAGE_ID}",
  "name": "Gauge Widget",
  "version": "${VERSION}",
  "author": "Jan Gabrielsson",
  "email": "jan@example.com",
  "description": "Visual gauge widget with rotating needle for sensor values (0-100%)",
  "homepage": "https://github.com/jangabrielsson/HomeMap",
  "license": "MIT",
  "requires": {
    "homeMapVersion": ">=0.1.7"
  },
  "provides": {
    "widgets": ["gauge"],
    "iconSets": ["gauge"]
  },
  "deviceTypes": [
    "com.fibaro.multilevelSensor",
    "com.fibaro.powerMeter"
  ],
  "tags": ["sensor", "visualization", "gauge", "meter"]
}
EOF

# Copy widget definition
mkdir -p "$TEMP_DIR/widgets"
cp "$HOMEMAP_DATA/widgets/gauge.json" "$TEMP_DIR/widgets/" 2>/dev/null || {
    echo "Error: gauge.json not found in $HOMEMAP_DATA/widgets/"
    echo "Please ensure the gauge widget exists first."
    rm -rf "$TEMP_DIR"
    exit 1
}

# Copy icon set
mkdir -p "$TEMP_DIR/icons"
cp -r "$HOMEMAP_DATA/icons/gauge" "$TEMP_DIR/icons/" 2>/dev/null || {
    echo "Warning: gauge icon set not found, package will not include icons"
}

# Create README
cat > "$TEMP_DIR/README.md" <<EOF
# Gauge Widget Package

Visual gauge widget with rotating needle for displaying sensor values (0-100%).

## Features

- Smooth needle rotation based on value
- Colored zones (green/yellow/red)
- Expression-based rendering
- SVG manipulation for internal element styling

## Compatibility

- HomeMap v0.1.7 or later
- Device types: com.fibaro.multilevelSensor, com.fibaro.powerMeter

## Installation

1. Download the .hwp file
2. In HomeMap, go to Settings → Packages
3. Click "Install Package" and select the file
4. The widget will be available immediately

## Usage

The gauge widget automatically applies to multilevelSensor devices.
You can customize the mapping in Settings → Widget Mappings.

## License

MIT License
EOF

# Create the .hwp file (ZIP archive)
OUTPUT_FILE="${PROJECT_ROOT}/${PACKAGE_NAME}-${VERSION}.hwp"
cd "$TEMP_DIR"
zip -r "$OUTPUT_FILE" . > /dev/null

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✓ Package created successfully!"
echo "  File: $OUTPUT_FILE"
echo "  Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "To test installation:"
echo "  1. Start HomeMap in dev mode"
echo "  2. Go to Settings → Packages"
echo "  3. Click 'Install Package'"
echo "  4. Select: $OUTPUT_FILE"
