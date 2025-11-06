#!/bin/bash

# Push file to Android emulator/device
# Usage: ./scripts/android-push.sh <file-path> [destination]
#
# Examples:
#   ./scripts/android-push.sh ~/Downloads/backup.zip
#   ./scripts/android-push.sh backup.zip /sdcard/Documents/

set -e

ADB="$ANDROID_HOME/platform-tools/adb"

# Check if file argument provided
if [ -z "$1" ]; then
    echo "Usage: $0 <file-path> [destination]"
    echo ""
    echo "Examples:"
    echo "  $0 ~/Downloads/homemap-backup.zip"
    echo "  $0 backup.zip /sdcard/Documents/"
    echo ""
    echo "Default destination: /sdcard/Download/"
    exit 1
fi

FILE_PATH="$1"
DEST="${2:-/sdcard/Download/}"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "❌ File not found: $FILE_PATH"
    exit 1
fi

# Get filename
FILENAME=$(basename "$FILE_PATH")

# Check if device/emulator is connected
if ! $ADB devices | grep -q "device$"; then
    echo "❌ No Android device/emulator connected"
    echo ""
    echo "Start emulator first:"
    echo "  ./scripts/android-start-emulator.sh"
    exit 1
fi

echo "📤 Pushing file to Android device..."
echo "  File: $FILENAME"
echo "  Size: $(du -h "$FILE_PATH" | cut -f1)"
echo "  Destination: $DEST"
echo ""

# Push the file
if $ADB push "$FILE_PATH" "$DEST"; then
    echo ""
    echo "✅ File pushed successfully!"
    echo ""
    echo "📱 File location on device: ${DEST}${FILENAME}"
    echo ""
    echo "You can now access it in HomeMap's file picker:"
    echo "  - Look in Downloads folder"
    echo "  - Or use the path: ${DEST}${FILENAME}"
else
    echo ""
    echo "❌ Failed to push file"
    exit 1
fi
