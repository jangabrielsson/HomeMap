#!/bin/bash
# Build HomeMap for iOS simulator

set -e  # Exit on error

cd "$(dirname "$0")/.."

echo "Building HomeMap for iOS simulator..."
cargo tauri ios build --target aarch64-sim 2>&1 | grep -E "(Compiling homemap|Finished|BUILD SUCCEEDED|BUILD FAILED|error)" | tail -20

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "App location:"
    echo "$HOME/Library/Developer/Xcode/DerivedData/homemap-*/Build/Products/release-iphonesimulator/HomeMap.app"
else
    echo ""
    echo "❌ Build failed!"
    exit 1
fi
