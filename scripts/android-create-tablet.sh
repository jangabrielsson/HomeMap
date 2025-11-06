#!/bin/bash

# Create Android Tablet Emulator for HomeMap
# This creates a Pixel Tablet emulator suitable for testing HomeMap

set -e

echo "📱 Creating Pixel Tablet Emulator for HomeMap"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if sdkmanager is available
if ! command -v sdkmanager &> /dev/null; then
    echo "❌ sdkmanager not found in PATH"
    echo "   Trying: $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
    SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
    if [ ! -f "$SDKMANAGER" ]; then
        echo "❌ sdkmanager not found!"
        echo "   Install it via Android Studio: Tools → SDK Manager → SDK Tools → Android SDK Command-line Tools"
        exit 1
    fi
else
    SDKMANAGER="sdkmanager"
fi

# Check if avdmanager is available
if ! command -v avdmanager &> /dev/null; then
    AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
    if [ ! -f "$AVDMANAGER" ]; then
        echo "❌ avdmanager not found!"
        exit 1
    fi
else
    AVDMANAGER="avdmanager"
fi

AVD_NAME="HomeMap_Tablet"
SYSTEM_IMAGE="system-images;android-34;google_apis;arm64-v8a"
DEVICE_TYPE="pixel_tablet"

echo "Configuration:"
echo "  Name: $AVD_NAME"
echo "  Device: Pixel Tablet"
echo "  API Level: 34 (Android 14)"
echo "  Architecture: arm64-v8a"
echo ""

# Check if AVD already exists
if $AVDMANAGER list avd | grep -q "Name: $AVD_NAME"; then
    echo "⚠️  Emulator '$AVD_NAME' already exists!"
    echo ""
    read -p "Delete and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing emulator..."
        $AVDMANAGER delete avd -n "$AVD_NAME"
    else
        echo "Cancelled."
        exit 0
    fi
fi

# Check if system image is installed
echo "📦 Checking system image..."
if ! $SDKMANAGER --list_installed | grep -q "$SYSTEM_IMAGE"; then
    echo "⬇️  System image not found, installing..."
    echo "   This will download ~800MB, please wait..."
    echo ""
    
    # Accept licenses automatically
    yes | $SDKMANAGER --licenses > /dev/null 2>&1 || true
    
    # Install system image
    $SDKMANAGER "$SYSTEM_IMAGE"
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install system image"
        exit 1
    fi
    
    echo "✅ System image installed"
else
    echo "✅ System image already installed"
fi

echo ""
echo "🔧 Creating emulator..."

# Create the AVD
$AVDMANAGER create avd \
    -n "$AVD_NAME" \
    -k "$SYSTEM_IMAGE" \
    -d "$DEVICE_TYPE" \
    --force

if [ $? -ne 0 ]; then
    echo "❌ Failed to create emulator"
    exit 1
fi

# Configure the AVD for better performance
AVD_CONFIG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"

if [ -f "$AVD_CONFIG" ]; then
    echo "⚙️  Configuring emulator settings..."
    
    # Set hardware properties for better performance
    cat >> "$AVD_CONFIG" << EOF

# Performance optimizations
hw.ramSize=4096
hw.gpu.enabled=yes
hw.gpu.mode=host
hw.keyboard=yes
showDeviceFrame=yes
skin.dynamic=yes
EOF
    
    echo "✅ Configuration updated"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tablet emulator created successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Emulator details:"
$AVDMANAGER list avd -c | grep "$AVD_NAME"
echo ""
echo "🚀 Start the emulator with:"
echo "   ./scripts/android-start-emulator.sh"
echo ""
echo "Or manually:"
echo "   \$ANDROID_HOME/emulator/emulator -avd $AVD_NAME &"
echo ""
