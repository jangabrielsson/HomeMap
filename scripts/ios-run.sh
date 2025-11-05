#!/bin/bash
# Install and launch HomeMap on iPad simulator

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
    echo "Available iPad simulators:"
    xcrun simctl list devices available | grep iPad
    exit 1
fi

echo "Using simulator: $SIM_ID"

# Find the app bundle (exclude Archive paths, prefer DerivedData/Build/Products)
APP_PATH=$(find "$HOME/Library/Developer/Xcode/DerivedData" -name "HomeMap.app" -path "*/Build/Products/release-iphonesimulator/*" 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
    echo "❌ App bundle not found! Did you run ios-build.sh first?"
    exit 1
fi

echo "Installing app from: $APP_PATH"
xcrun simctl install "$SIM_ID" "$APP_PATH"

echo ""
echo "✅ App installed successfully!"
echo ""
echo "Launching app..."
xcrun simctl launch --console "$SIM_ID" com.gabrielsson.homemap
