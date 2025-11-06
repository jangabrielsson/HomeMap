#!/bin/bash

# Quick Android Setup Guide
# Run this to see what you need to do

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖  HomeMap Android Development Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check what's already done
echo "📊 Current Status:"
echo ""

# Rust targets
if rustup target list --installed | grep -q "aarch64-linux-android"; then
    echo "✅ Rust Android targets installed"
else
    echo "❌ Rust Android targets NOT installed"
    echo "   Run: rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android"
fi

# Cargo config
if [ -f ".cargo/config.toml" ]; then
    echo "✅ Cargo NDK configuration ready"
else
    echo "❌ Cargo NDK configuration missing"
fi

# Tauri CLI
if command -v cargo-tauri &> /dev/null; then
    echo "✅ Tauri CLI installed"
else
    echo "❌ Tauri CLI NOT installed"
    echo "   Run: cargo install tauri-cli"
fi

# Android Studio
if [ -d "/Applications/Android Studio.app" ]; then
    echo "✅ Android Studio installed"
else
    echo "❌ Android Studio NOT installed"
    echo "   Download: https://developer.android.com/studio"
fi

# Environment variables
if [ -n "$ANDROID_HOME" ]; then
    echo "✅ ANDROID_HOME set: $ANDROID_HOME"
else
    echo "❌ ANDROID_HOME NOT set"
    echo "   Run: ./scripts/setup-android-env.sh --auto"
fi

if [ -n "$ANDROID_NDK_HOME" ]; then
    echo "✅ ANDROID_NDK_HOME set"
else
    echo "❌ ANDROID_NDK_HOME NOT set"
    echo "   Install NDK in Android Studio, then run: ./scripts/setup-android-env.sh --auto"
fi

if [ -n "$JAVA_HOME" ]; then
    echo "✅ JAVA_HOME set"
else
    echo "❌ JAVA_HOME NOT set"
    echo "   Run: ./scripts/setup-android-env.sh --auto"
fi

# Android project
if [ -d "src-tauri/gen/android" ]; then
    echo "✅ Android project initialized"
else
    echo "❌ Android project NOT initialized"
    echo "   Run: ./scripts/init-android.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Provide next steps
if [ ! -d "/Applications/Android Studio.app" ]; then
    echo "📝 NEXT STEP: Install Android Studio"
    echo ""
    echo "1. Download from: https://developer.android.com/studio"
    echo "2. Install to Applications folder"
    echo "3. Open Android Studio and complete setup wizard"
    echo "4. Install NDK: Tools → SDK Manager → SDK Tools → NDK"
    echo "5. Create emulator: Tools → Device Manager → Create Device"
    echo ""
    echo "📖 Full guide: docs/ANDROID_INSTALL.md"
    echo "✅ Checklist: docs/ANDROID_CHECKLIST.md"
    echo ""
elif [ -z "$ANDROID_HOME" ]; then
    echo "📝 NEXT STEP: Configure Environment"
    echo ""
    echo "Run these commands:"
    echo "  ./scripts/setup-android-env.sh --auto"
    echo "  source ~/.zshrc"
    echo ""
elif [ ! -d "src-tauri/gen/android" ]; then
    echo "📝 NEXT STEP: Initialize Android Project"
    echo ""
    echo "Run: ./scripts/init-android.sh"
    echo ""
else
    echo "🎉 Setup Complete! Ready to build."
    echo ""
    echo "To build and run:"
    echo "  ./scripts/android-start-emulator.sh    # Start emulator"
    echo "  ./scripts/android-rebuild.sh            # Build and run app"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
