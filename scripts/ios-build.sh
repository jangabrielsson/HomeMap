#!/bin/bash
# Build HomeMap for iOS (simulator or device)

set -e  # Exit on error

cd "$(dirname "$0")/.."

echo "🔨 Building HomeMap for iOS..."

# Check if building for device or simulator (default to simulator)
TARGET="${1:-simulator}"

if [ "$TARGET" = "device" ]; then
    echo "Building for physical iOS device..."
    cargo tauri ios build --target aarch64
else
    echo "Building for iOS simulator..."
    # Use Tauri's simplified target names
    if [ "$(uname -m)" = "arm64" ]; then
        echo "Apple Silicon Mac detected - building for aarch64-sim..."
        cargo tauri ios build --target aarch64-sim
    else
        echo "Intel Mac detected - building for x86_64..."
        cargo tauri ios build --target x86_64
    fi
fi

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "To run the app:"
echo "  On simulator: ./scripts/ios-run.sh"
echo "  On device:    ./scripts/ios-device.sh"
