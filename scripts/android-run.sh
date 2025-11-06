#!/bin/bash

# Install and run HomeMap on Android emulator/device
# This script installs the APK and launches the app

set -e

cd "$(dirname "$0")/.."

PACKAGE_NAME="com.gabrielsson.homemap"
ADB="$ANDROID_HOME/platform-tools/adb"

# Look for debug APK first (signed for development)
APK_PATH=$(find src-tauri/gen/android/app/build/outputs/apk -name "*-debug.apk" | head -1)

# If no debug APK, look for release
if [ -z "$APK_PATH" ]; then
    APK_PATH=$(find src-tauri/gen/android/app/build/outputs/apk -name "*-release-unsigned.apk" | head -1)
fi

# Check if emulator/device is connected
if ! $ADB devices | grep -q "device$"; then
    echo "Error: No Android device or emulator connected"
    echo "Run ./scripts/android-start-emulator.sh first"
    exit 1
fi

# Check if APK exists
if [ -z "$APK_PATH" ] || [ ! -f "$APK_PATH" ]; then
    echo "APK not found. Building first..."
    ./scripts/android-build.sh
    APK_PATH=$(find src-tauri/gen/android/app/build/outputs/apk -name "*-debug.apk" | head -1)
    if [ -z "$APK_PATH" ]; then
        APK_PATH=$(find src-tauri/gen/android/app/build/outputs/apk -name "*-release-unsigned.apk" | head -1)
    fi
fi

echo "Installing HomeMap on Android device..."
echo "APK: $APK_PATH"
$ADB install -r "$APK_PATH"

echo ""
echo "Launching HomeMap..."
$ADB shell am start -n "$PACKAGE_NAME/.MainActivity"

echo ""
echo "✓ HomeMap is running!"
echo ""
echo "View logs with: adb logcat | grep HomeMap"
