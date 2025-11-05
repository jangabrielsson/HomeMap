#!/bin/bash
# Simplified iOS rebuild using Tauri commands (works without full Xcode)

set -e

cd "$(dirname "$0")/.."

echo "🏗️  Building iOS app..."
echo "Building HomeMap for iOS..."

# Use Tauri's iOS build command
cargo tauri ios build

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📱 To run in development mode (requires iOS simulator), use:"
echo "   cargo tauri ios dev"
echo ""
echo "💡 Note: For simulator support, install full Xcode from the App Store"
echo "   Then run: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"