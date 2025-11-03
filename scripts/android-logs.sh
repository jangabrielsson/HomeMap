#!/bin/bash

# View HomeMap logs from Android device
# This script shows real-time logs from the app

PACKAGE_NAME="com.homemap.app"

echo "Showing HomeMap logs (Ctrl+C to stop)..."
echo ""

adb logcat | grep -i "homemap\|tauri\|rust"
