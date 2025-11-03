#!/bin/bash

# Build HomeMap for Android
# This script builds the Android APK for the emulator/device

set -e

echo "Building HomeMap for Android..."
echo "This may take several minutes on first build (Gradle downloads dependencies)..."
echo ""

cd "$(dirname "$0")/.."

# Generate asset manifest before build
./scripts/generate-asset-manifest.sh

# Build for debug (includes signing for development)
# Only build aarch64 (arm64-v8a) for faster development builds on Apple Silicon emulator
cargo tauri android build --debug --target aarch64

echo ""
echo "✓ Build complete!"
echo ""
echo "APK location:"
ls -lh src-tauri/gen/android/app/build/outputs/apk/*/debug/*.apk 2>/dev/null || \
ls -lh src-tauri/gen/android/app/build/outputs/apk/debug/*.apk 2>/dev/null || \
echo "APK built in: src-tauri/gen/android/app/build/outputs/apk/"
