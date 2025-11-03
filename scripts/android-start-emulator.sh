#!/bin/bash

# Start Android emulator for HomeMap development
# This script starts the Pixel Tablet emulator in the background

set -e

AVD_NAME="Pixel_Tablet"

# Check if emulator is already running
if adb devices | grep -q "emulator"; then
    echo "✓ Emulator already running"
    adb devices
    exit 0
fi

echo "Starting Android emulator: $AVD_NAME..."
echo "This will take 30-60 seconds..."

# Start emulator in background
$ANDROID_HOME/emulator/emulator -avd "$AVD_NAME" -no-snapshot-load > /dev/null 2>&1 &

# Wait for emulator to boot
echo "Waiting for emulator to boot..."
adb wait-for-device

# Wait for boot to complete
while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    echo "Booting..."
    sleep 2
done

echo ""
echo "✓ Emulator is ready!"
adb devices
