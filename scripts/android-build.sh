#!/bin/bash

# Build HomeMap for Android
# This script builds the Android APK for the emulator/device
#
# Usage:
#   ./android-build.sh              - Build release APK for ARM64 only (default, ~22MB)
#   ./android-build.sh --debug      - Build debug APK for ARM64 only
#   ./android-build.sh --all        - Build release APK for all architectures (~82MB)

set -e

cd "$(dirname "$0")/.."

# Parse arguments
BUILD_FLAGS=""
BUILD_TARGET="--target aarch64"
BUILD_TYPE="release"

if [[ "$1" == "--all" ]]; then
    BUILD_TARGET=""
    echo "Building HomeMap for Android (all architectures - release)..."
elif [[ "$1" == "--debug" ]]; then
    BUILD_FLAGS="--debug"
    BUILD_TYPE="debug"
    echo "Building HomeMap for Android (debug - ARM64 only)..."
else
    # Default to release build for ARM64 only (most modern devices)
    echo "Building HomeMap for Android (ARM64 only - release)..."
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

# Sign the APK if it's a release build
if [[ "$BUILD_TYPE" == "release" ]]; then
    echo ""
    echo "Signing APK with debug keystore..."
    
    # Find the unsigned APK
    UNSIGNED_APK=$(find src-tauri/gen/android/app/build/outputs/apk/universal/release -name "*-unsigned.apk" | head -1)
    
    if [[ -n "$UNSIGNED_APK" ]]; then
        SIGNED_APK="${UNSIGNED_APK/-unsigned/-signed}"
        
        # Sign with apksigner (creates v2/v3 signatures required by modern Android)
        if [[ -f ~/.android/debug.keystore ]]; then
            # Find the latest apksigner
            APKSIGNER=$(ls -d $ANDROID_HOME/build-tools/*/apksigner 2>/dev/null | tail -1)
            
            "$APKSIGNER" sign \
                --ks ~/.android/debug.keystore \
                --ks-pass pass:android \
                --key-pass pass:android \
                --out "$SIGNED_APK" \
                "$UNSIGNED_APK"
            
            echo "✓ APK signed successfully"
            echo ""
            echo "Signed APK:"
            ls -lh "$SIGNED_APK"
            
            # Copy to dist folder for easy access
            mkdir -p dist
            cp "$SIGNED_APK" dist/
            echo ""
            echo "Copied to: dist/$(basename "$SIGNED_APK")"
        else
            echo "⚠️  Debug keystore not found at ~/.android/debug.keystore"
            echo "   APK is unsigned and may not install on some devices"
        fi
    fi
fi

echo ""
echo "APK location:"
ls -lh src-tauri/gen/android/app/build/outputs/apk/*/$BUILD_TYPE/*.apk 2>/dev/null || \
ls -lh src-tauri/gen/android/app/build/outputs/apk/$BUILD_TYPE/*.apk 2>/dev/null || \
echo "APK built in: src-tauri/gen/android/app/build/outputs/apk/"
