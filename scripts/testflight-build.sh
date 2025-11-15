#!/bin/bash
set -e

# TestFlight Distribution Build Script
# Builds and exports an IPA suitable for TestFlight/App Store distribution

echo "🚀 Building HomeMap for TestFlight distribution..."

cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Configuration
PROJECT_PATH="$PROJECT_ROOT/src-tauri/gen/apple"
SCHEME="homemap_iOS"
ARCHIVE_PATH="$PROJECT_ROOT/build/ios/HomeMap.xcarchive"
EXPORT_PATH="$PROJECT_ROOT/build/ios/export"
EXPORT_OPTIONS="$PROJECT_ROOT/scripts/ExportOptions.plist"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$ARCHIVE_PATH"
rm -rf "$EXPORT_PATH"
mkdir -p "$(dirname "$ARCHIVE_PATH")"
mkdir -p "$EXPORT_PATH"

# Note: Xcode Archive builds the Rust code automatically via build phase
# So we skip the Rust build here and go straight to archiving
echo "📦 Rust build will be handled by Xcode build phase..."

# Create archive
echo "📦 Creating archive..."
cd "$PROJECT_PATH"
xcodebuild archive \
  -project homemap.xcodeproj \
  -scheme "$SCHEME" \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -configuration Release \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="${APPLE_TEAM_ID:-}" \
  | xcbeautify || cat

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "❌ Archive creation failed!"
    exit 1
fi

echo "✅ Archive created successfully!"

# Create ExportOptions.plist if it doesn't exist
if [ ! -f "$EXPORT_OPTIONS" ]; then
    echo "📝 Creating ExportOptions.plist..."
    cat > "$EXPORT_OPTIONS" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
EOF
fi

# Export IPA
echo "📤 Exporting IPA for TestFlight..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  | xcbeautify || cat

IPA_PATH="$EXPORT_PATH/HomeMap.ipa"

if [ -f "$IPA_PATH" ]; then
    echo ""
    echo "✅ TestFlight build complete!"
    echo "📦 IPA location: $IPA_PATH"
    echo ""
    echo "Next steps:"
    echo "  1. Upload to TestFlight: xcrun altool --upload-app -f \"$IPA_PATH\" -t ios --apiKey YOUR_KEY --apiIssuer YOUR_ISSUER"
    echo "  2. Or use Xcode: Organizer → Archives → Distribute App"
    echo "  3. Or use Transporter app for manual upload"
else
    echo "❌ IPA export failed!"
    exit 1
fi
