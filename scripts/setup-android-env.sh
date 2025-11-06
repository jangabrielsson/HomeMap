#!/bin/bash

# Android Development Environment Setup
# Run this script after installing Android Studio

echo "🔧 Setting up Android environment variables..."

# Detect Android Studio installation
ANDROID_STUDIO_APP="/Applications/Android Studio.app"
if [ ! -d "$ANDROID_STUDIO_APP" ]; then
    echo "❌ Android Studio not found at: $ANDROID_STUDIO_APP"
    echo "Please install Android Studio first from: https://developer.android.com/studio"
    exit 1
fi

# Android SDK location
ANDROID_SDK="$HOME/Library/Android/sdk"
if [ ! -d "$ANDROID_SDK" ]; then
    echo "❌ Android SDK not found at: $ANDROID_SDK"
    echo "Please run Android Studio and install the SDK through the setup wizard"
    exit 1
fi

# Find NDK version
NDK_DIR="$ANDROID_SDK/ndk"
if [ ! -d "$NDK_DIR" ]; then
    echo "❌ NDK not installed"
    echo "Please install NDK through Android Studio:"
    echo "  Tools → SDK Manager → SDK Tools → NDK (Side by side)"
    exit 1
fi

# Get the latest NDK version installed
NDK_VERSION=$(ls -1 "$NDK_DIR" | sort -V | tail -1)
if [ -z "$NDK_VERSION" ]; then
    echo "❌ No NDK version found in $NDK_DIR"
    exit 1
fi

ANDROID_NDK="$NDK_DIR/$NDK_VERSION"
echo "✅ Found NDK version: $NDK_VERSION"

# Java (bundled with Android Studio)
JAVA_HOME="$ANDROID_STUDIO_APP/Contents/jbr/Contents/Home"
if [ ! -d "$JAVA_HOME" ]; then
    echo "⚠️  Java not found in Android Studio bundle, checking system Java..."
    JAVA_HOME=$(java_home -v 21 2>/dev/null || java_home 2>/dev/null || echo "")
    if [ -z "$JAVA_HOME" ]; then
        echo "❌ Java not found. Please ensure Android Studio is properly installed."
        exit 1
    fi
fi

echo "✅ Found Java at: $JAVA_HOME"

# Generate environment variables
ENV_VARS=$(cat <<EOF

# Android Development Environment
export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_NDK_HOME="$ANDROID_NDK"
export JAVA_HOME="$JAVA_HOME"
export PATH="\$PATH:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/cmdline-tools/latest/bin"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF
)

echo ""
echo "✅ Android environment detected successfully!"
echo ""
echo "📝 Add these lines to your ~/.zshrc file:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$ENV_VARS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Then run: source ~/.zshrc"
echo ""
echo "Or, automatically append to ~/.zshrc with:"
echo "  ./scripts/setup-android-env.sh --auto"
echo ""

# Auto-append option
if [ "$1" == "--auto" ]; then
    # Check if already added
    if grep -q "# Android Development Environment" ~/.zshrc; then
        echo "⚠️  Android environment variables already in ~/.zshrc"
        echo "To update, remove the old entries first"
    else
        echo "$ENV_VARS" >> ~/.zshrc
        echo "✅ Environment variables added to ~/.zshrc"
        echo "Run: source ~/.zshrc"
    fi
fi
