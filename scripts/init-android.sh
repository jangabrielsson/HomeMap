#!/bin/bash

# HomeMap Android Project Initialization
# This script initializes the Tauri Android project after Android Studio is set up

echo "🚀 HomeMap Android Project Initialization"
echo "=========================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Android Studio
if [ ! -d "/Applications/Android Studio.app" ]; then
    echo "❌ Android Studio not found"
    echo "   Install from: https://developer.android.com/studio"
    exit 1
fi
echo "✅ Android Studio installed"

# Check ANDROID_HOME
if [ -z "$ANDROID_HOME" ]; then
    echo "❌ ANDROID_HOME not set"
    echo "   Run: ./scripts/setup-android-env.sh"
    echo "   Then: source ~/.zshrc"
    exit 1
fi
echo "✅ ANDROID_HOME set: $ANDROID_HOME"

# Check Android SDK
if [ ! -d "$ANDROID_HOME" ]; then
    echo "❌ Android SDK not found at: $ANDROID_HOME"
    exit 1
fi
echo "✅ Android SDK found"

# Check NDK
if [ -z "$ANDROID_NDK_HOME" ]; then
    echo "❌ ANDROID_NDK_HOME not set"
    echo "   Install NDK via Android Studio: Tools → SDK Manager → SDK Tools → NDK"
    echo "   Then run: ./scripts/setup-android-env.sh"
    exit 1
fi
if [ ! -d "$ANDROID_NDK_HOME" ]; then
    echo "❌ NDK not found at: $ANDROID_NDK_HOME"
    exit 1
fi
echo "✅ NDK found: $ANDROID_NDK_HOME"

# Check Java
if [ -z "$JAVA_HOME" ]; then
    echo "❌ JAVA_HOME not set"
    echo "   Run: ./scripts/setup-android-env.sh"
    exit 1
fi
java_version=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "✅ Java $java_version found"

# Check Rust Android targets
echo ""
echo "📋 Checking Rust Android targets..."
targets_needed=("aarch64-linux-android" "armv7-linux-androideabi" "i686-linux-android" "x86_64-linux-android")
missing_targets=()

for target in "${targets_needed[@]}"; do
    if ! rustup target list --installed | grep -q "^$target$"; then
        missing_targets+=("$target")
    else
        echo "✅ $target installed"
    fi
done

if [ ${#missing_targets[@]} -gt 0 ]; then
    echo ""
    echo "❌ Missing Rust targets: ${missing_targets[*]}"
    echo "   Install with: rustup target add ${missing_targets[*]}"
    exit 1
fi

echo ""
echo "✅ All prerequisites met!"
echo ""

# Check if already initialized
if [ -d "src-tauri/gen/android" ]; then
    echo "⚠️  Android project already initialized at: src-tauri/gen/android"
    echo ""
    read -p "Reinitialize? This will overwrite existing files (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    echo "🔄 Removing existing Android project..."
    rm -rf src-tauri/gen/android
fi

# Initialize Android project
echo "🔧 Initializing Tauri Android project..."
echo ""

cd src-tauri || exit 1

# Run tauri android init
if ! cargo tauri android init; then
    echo ""
    echo "❌ Android initialization failed"
    echo "   This usually means Tauri CLI is not installed or outdated"
    echo ""
    echo "   Try: cargo install tauri-cli --version '^2.0.0'"
    exit 1
fi

echo ""
echo "✅ Android project initialized successfully!"
echo ""
echo "📱 Next steps:"
echo "   1. Create an Android Virtual Device (AVD) in Android Studio"
echo "   2. Start the emulator: ./scripts/android-start-emulator.sh"
echo "   3. Build the app: ./scripts/android-build.sh"
echo "   4. Run the app: ./scripts/android-run.sh"
echo ""
echo "   Or use the all-in-one script: ./scripts/android-rebuild.sh"
echo ""
