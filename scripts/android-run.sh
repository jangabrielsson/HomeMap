#!/bin/bash

# Install and run HomeMap on Android emulator/device
# This script installs the APK and launches the app

set -e

PACKAGE_NAME="com.homemap.app"
# Look for debug APK first (signed for development)
APK_PATH=$(find src-tauri/gen/android/app/build/outputs/apk -name "*-debug.apk" | head -1)

cd "$(dirname "$0")/.."

# Check if emulator/device is connected
if ! adb devices | grep -q "device$"; then
    echo "Error: No Android device or emulator connected"
    echo "Run ./scripts/android-start-emulator.sh first"
    exit 1
fi

# Check if APK exists
if [ ! -f "$APK_PATH" ]; then
    echo "APK not found. Building first..."
    ./scripts/android-build.sh
fi

echo "Installing HomeMap on Android device..."
adb install -r "$APK_PATH"

echo ""
echo "Launching HomeMap..."
adb shell am start -n "$PACKAGE_NAME/.MainActivity"

echo ""
echo "✓ HomeMap is running!"
echo ""
echo "View logs with: adb logcat | grep HomeMap"
