#!/bin/bash

# Build HomeMap for Android
# This script builds the Android APK for the emulator/device
#
# Usage:
#   ./android-build.sh              - Build release APK for all architectures (default)
#   ./android-build.sh --release    - Build release APK for all architectures (explicit)
#   ./android-build.sh --debug      - Build debug APK for all architectures
#   ./android-build.sh --fast       - Build release APK for aarch64 only (Apple Silicon)

set -e

cd "$(dirname "$0")/.."

# Parse arguments
BUILD_FLAGS=""
BUILD_TARGET=""
BUILD_TYPE="release"

if [[ "$1" == "--fast" ]]; then
    BUILD_TARGET="--target aarch64"
    echo "Building HomeMap for Android (aarch64 only - fast mode, release)..."
elif [[ "$1" == "--debug" ]]; then
    BUILD_FLAGS="--debug"
    BUILD_TYPE="debug"
    echo "Building HomeMap for Android (debug - all architectures)..."
elif [[ "$1" == "--release" ]]; then
    echo "Building HomeMap for Android (release - all architectures)..."
else
    # Default to release build for all architectures
    echo "Building HomeMap for Android (release - all architectures)..."
fi

echo "This may take several minutes on first build (Gradle downloads dependencies)..."
echo ""

# Generate asset manifest before build
./scripts/generate-asset-manifest.sh

# Build for release or debug
# When no --target is specified, builds for all architectures:
#   - armeabi-v7a (32-bit ARM)
#   - arm64-v8a (64-bit ARM) 
#   - x86 (32-bit Intel)
#   - x86_64 (64-bit Intel)
# Note: Release is default, --debug flag makes it a debug build
cargo tauri android build $BUILD_FLAGS $BUILD_TARGET

echo ""
echo "✓ Build complete!"
echo ""
echo "APK location:"
ls -lh src-tauri/gen/android/app/build/outputs/apk/*/$BUILD_TYPE/*.apk 2>/dev/null || \
ls -lh src-tauri/gen/android/app/build/outputs/apk/$BUILD_TYPE/*.apk 2>/dev/null || \
echo "APK built in: src-tauri/gen/android/app/build/outputs/apk/"
