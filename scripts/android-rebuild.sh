#!/bin/bash

# Full rebuild and test cycle for Android
# This script: cleans, builds, installs, and runs HomeMap on Android

set -e

cd "$(dirname "$0")/.."

echo "=== HomeMap Android Rebuild Pipeline ==="
echo ""

# 0. Generate asset manifest
echo "0. Generating asset manifest..."
./scripts/generate-asset-manifest.sh

# 1. Clean
echo ""
echo "1. Cleaning previous builds..."
cd src-tauri/gen/android
./gradlew clean
cd ../../..

# 2. Build
echo ""
echo "2. Building..."
./scripts/android-build.sh

# 3. Ensure emulator is running
echo ""
echo "3. Checking emulator..."
./scripts/android-start-emulator.sh

# 4. Install and run
echo ""
echo "4. Installing and running..."
./scripts/android-run.sh

echo ""
echo "=== ✓ Complete! ==="
