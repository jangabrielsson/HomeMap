#!/bin/bash
# Deploy HomeMap to connected iPad device

set -e

cd "$(dirname "$0")/.."

echo "� Deploying HomeMap to physical iPad..."

# Check if device is connected
echo "Detecting connected iPad..."
xcrun devicectl list devices

DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null | grep "iPad" | grep "available" | awk '{print $3}')

if [ -z "$DEVICE_ID" ]; then
    echo "❌ No iPad device connected!"
    echo ""
    echo "Make sure your iPad is:"
    echo "  1. Connected via USB-C"
    echo "  2. Unlocked and trusted this computer"  
    echo "  3. In Developer mode (Settings > Privacy & Security > Developer Mode)"
    echo ""
    echo "Available devices:"
    xcrun devicectl list devices
    exit 1
fi

echo "✅ Found iPad: $DEVICE_ID"

# Find the built app
APP_PATH=$(find "$HOME/Library/Developer/Xcode/DerivedData/homemap-"* -name "HomeMap.app" -path "*/Build/Products/release-iphoneos/*" 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
    echo "⚠️  No device build found. Building for device..."
    echo ""
    echo "NOTE: If this fails with a signing error, you need to configure signing in Xcode:"
    echo "  1. Open: src-tauri/gen/apple/homemap.xcodeproj"
    echo "  2. Select 'homemap_iOS' target → 'Signing & Capabilities'"
    echo "  3. Check 'Automatically manage signing' and select your Apple ID team"
    echo ""
    
    # Try to build
    if ! ./scripts/ios-build.sh device; then
        echo ""
        echo "❌ Build failed!"
        echo ""
        read -p "Open Xcode to configure signing? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open src-tauri/gen/apple/homemap.xcodeproj
            echo ""
            echo "After configuring signing in Xcode, run this script again."
        fi
        exit 1
    fi
    
    # Find the app again after successful build
    APP_PATH=$(find "$HOME/Library/Developer/Xcode/DerivedData/homemap-"* -name "HomeMap.app" -path "*/Build/Products/release-iphoneos/*" 2>/dev/null | head -1)
    
    if [ -z "$APP_PATH" ]; then
        echo "❌ Build succeeded but app not found!"
        exit 1
    fi
fi

echo "✅ Found app: $APP_PATH"

echo "📲 Installing on iPad..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

echo "🎉 Launching HomeMap..."
xcrun devicectl device process launch --device "$DEVICE_ID" com.gabrielsson.homemap

echo ""
echo "✅ HomeMap is now running on your iPad!"