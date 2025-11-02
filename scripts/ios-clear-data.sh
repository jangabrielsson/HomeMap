#!/bin/bash
# Clear HomeMap app data on iPad simulator

set -e

cd "$(dirname "$0")/.."

# Find iPad simulator ID (prefer booted)
echo "Finding iPad simulator..."
SIM_ID=$(xcrun simctl list devices | grep "iPad Pro 13-inch (M4)" | grep "Booted" | grep -o '[A-F0-9-]\{36\}' | head -1)

if [ -z "$SIM_ID" ]; then
    # No booted iPad, find any available one
    SIM_ID=$(xcrun simctl list devices available | grep "iPad Pro 13-inch (M4)" | grep -o '[A-F0-9-]\{36\}' | head -1)
fi

if [ -z "$SIM_ID" ]; then
    echo "❌ No iPad Pro 13-inch (M4) simulator found!"
    exit 1
fi

echo "Using simulator: $SIM_ID"

# Get app container (works even if container ID changes)
CONTAINER=$(xcrun simctl get_app_container "$SIM_ID" com.gabrielsson.homemap data 2>/dev/null)

if [ -z "$CONTAINER" ]; then
    echo "❌ App not installed on simulator"
    exit 1
fi

echo "App container: $CONTAINER"
echo ""
echo "Clearing homemapdata folder..."
rm -rf "$CONTAINER/Library/Application Support/HomeMap/homemapdata"

echo "✅ App data cleared!"
echo ""
echo "Next time the app launches, it will recreate from template."
