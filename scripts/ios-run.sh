#!/bin/bash
# Install and launch HomeMap on iPad simulator

set -e

cd "$(dirname "$0")/.."

echo "📱 Running HomeMap on iPad simulator..."

# Find the app bundle
APP_PATH=$(find "$HOME/Library/Developer/Xcode/DerivedData/homemap-"* -name "HomeMap.app" -path "*/Build/Products/release-iphonesimulator/*" 2>/dev/null | head -1)

if [ -z "$APP_PATH" ]; then
    echo "❌ App bundle not found! Run ./scripts/ios-build.sh first"
    exit 1
fi

echo "✅ Found app: $APP_PATH"

# Get the booted device ID, prefer iPad
DEVICE_ID=$(xcrun simctl list devices | grep "Booted" | grep "iPad" | grep -oE "\([-A-F0-9]+\)" | head -1 | tr -d "()")

if [ -z "$DEVICE_ID" ]; then
    echo "⚠️  No iPad simulator booted, looking for available iPad..."
    # Try to find iPad Pro 12.9-inch first, then any iPad Pro, then any iPad
    DEVICE_ID=$(xcrun simctl list devices available | grep -E "iPad Pro \(12.9-inch\)|iPad Pro" | head -1 | grep -oE "\([-A-F0-9]+\)" | tr -d "()")
    
    if [ -z "$DEVICE_ID" ]; then
        DEVICE_ID=$(xcrun simctl list devices available | grep "iPad" | head -1 | grep -oE "\([-A-F0-9]+\)" | tr -d "()")
    fi
    
    if [ -z "$DEVICE_ID" ]; then
        echo "❌ No iPad simulator found! Please create one in Xcode."
        exit 1
    fi
    
    echo "🚀 Booting iPad simulator..."
    # Shutdown any other booted devices first
    xcrun simctl list devices | grep "Booted" | grep -oE "\([-A-F0-9]+\)" | tr -d "()" | while read -r BOOTED_ID; do
        if [ "$BOOTED_ID" != "$DEVICE_ID" ]; then
            echo "Shutting down other simulator: $BOOTED_ID"
            xcrun simctl shutdown "$BOOTED_ID" 2>/dev/null || true
        fi
    done
    
    # Boot the iPad
    xcrun simctl boot "$DEVICE_ID"
    
    # Open Simulator app
    open -a Simulator
    sleep 3
fi

echo "📲 Installing app on simulator..."
xcrun simctl install "$DEVICE_ID" "$APP_PATH"

echo "🎉 Launching HomeMap..."
xcrun simctl launch "$DEVICE_ID" com.gabrielsson.homemap
    exit 1
fi

echo "Installing app from: $APP_PATH"
xcrun simctl install "$SIM_ID" "$APP_PATH"

echo ""
echo "✅ App installed successfully!"
echo ""
echo "Launching app..."
xcrun simctl launch --console "$SIM_ID" com.gabrielsson.homemap
