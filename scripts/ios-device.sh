#!/bin/bash
# Build and deploy HomeMap to connected iPad device

set -e

cd "$(dirname "$0")/.."

echo "🚀 Building and deploying HomeMap to iPad device..."

# Check if device is connected
DEVICE_ID=$(xcrun devicectl list devices | grep "iPad" | grep "available" | awk '{print $3}')

if [ -z "$DEVICE_ID" ]; then
    echo "❌ No iPad device connected or available!"
    echo "Make sure your iPad is:"
    echo "  1. Connected via USB-C"
    echo "  2. Unlocked and trusted this computer"
    echo "  3. In Developer mode (if iOS 16+)"
    exit 1
fi

echo "✅ Found iPad: $DEVICE_ID"

# Generate asset manifest
echo "📦 Generating asset manifest..."
chmod +x scripts/generate-asset-manifest.sh
./scripts/generate-asset-manifest.sh

# Initialize iOS project if needed
if [ ! -d "src-tauri/gen/apple" ]; then
    echo "🔧 Initializing Tauri iOS project..."
    cargo tauri ios init
fi

# Build and deploy to device
echo "🔨 Building for iOS device..."
cargo tauri ios build --debug --open

echo "📱 This will open Xcode where you can deploy to your iPad!"
echo ""
echo "In Xcode:"
echo "  1. Select your iPad from the device dropdown"
echo "  2. Sign in with your Apple ID if prompted"
echo "  3. Select your development team"
echo "  4. Click the 'Play' button to build and install"
echo ""
echo "If you get code signing errors:"
echo "  1. Select the HomeMap target"
echo "  2. Go to Signing & Capabilities"
echo "  3. Check 'Automatically manage signing'"
echo "  4. Select your Apple ID team"