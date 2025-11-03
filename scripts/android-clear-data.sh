#!/bin/bash

# Clear HomeMap data on Android device
# This removes all app data to start fresh

set -e

PACKAGE_NAME="com.homemap.app"

cd "$(dirname "$0")/.."

# Check if emulator/device is connected
if ! adb devices | grep -q "device$"; then
    echo "Error: No Android device or emulator connected"
    exit 1
fi

echo "Clearing HomeMap app data on Android device..."
adb shell pm clear "$PACKAGE_NAME"

echo ""
echo "✓ App data cleared!"
echo ""
echo "The app will use the bundled template data on next launch."
