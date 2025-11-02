#!/bin/bash
# Full rebuild: build, clear data, install, and launch

set -e

cd "$(dirname "$0")"

echo "🏗️  Building..."
./ios-build.sh

echo ""
echo "🗑️  Clearing old data..."
./ios-clear-data.sh 2>/dev/null || echo "No existing data to clear"

echo ""
echo "📱 Installing and launching..."
./ios-run.sh
