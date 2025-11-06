#!/bin/bash

# Start Android emulator for HomeMap development
# Usage: ./android-start-emulator.sh [number]
#   number: Optional 1-N to select specific emulator
#
# Examples:
#   ./android-start-emulator.sh     # Auto-select (prefers tablets/Pixel devices)
#   ./android-start-emulator.sh 2   # Start emulator #2 from the list

set -e

# Set up paths
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"

# Check if emulator is already running
if $ADB devices | grep -q "emulator"; then
    echo "✓ Emulator already running"
    $ADB devices
    exit 0
fi

# List available AVDs
echo "📱 Available Android emulators:"
AVDS=($($EMULATOR -list-avds 2>/dev/null))

if [ ${#AVDS[@]} -eq 0 ]; then
    echo "❌ No Android emulators found!"
    echo ""
    echo "Create one using Android Studio:"
    echo "  Method 1: Tools → Device Manager → Create Device"
    echo "  Method 2: View → Tool Windows → Device Manager → Create Device"
    echo "  Method 3: Press Cmd+Shift+A, search 'Device Manager'"
    echo ""
    echo "Or see: docs/FIND_DEVICE_MANAGER.md"
    exit 1
fi

# Show available emulators
for i in "${!AVDS[@]}"; do
    echo "  $((i+1)). ${AVDS[$i]}"
done

echo ""

# Check if user provided a number
if [ -n "$1" ]; then
    CHOICE="$1"
    
    # Validate choice
    if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "${#AVDS[@]}" ]; then
        echo "❌ Invalid choice: $CHOICE"
        echo "Please choose a number between 1 and ${#AVDS[@]}"
        exit 1
    fi
    
    # Get the selected AVD (array is 0-indexed)
    AVD_NAME="${AVDS[$((CHOICE-1))]}"
    echo "Selected: #$CHOICE - $AVD_NAME"
else
    # Auto-select: Prefer tablets, then Pixel devices, then first available
    AVD_NAME="${AVDS[0]}"
    
    # First priority: Tablets
    for avd in "${AVDS[@]}"; do
        if [[ "$avd" == *Tablet* ]] || [[ "$avd" == *tablet* ]]; then
            AVD_NAME="$avd"
            echo "Auto-selected tablet: $AVD_NAME"
            break
        fi
    done
    
    # Second priority: Pixel devices (if no tablet found)
    if [[ "$AVD_NAME" != *Tablet* ]] && [[ "$AVD_NAME" != *tablet* ]]; then
        for avd in "${AVDS[@]}"; do
            if [[ "$avd" == Pixel* ]]; then
                AVD_NAME="$avd"
                echo "Auto-selected Pixel device: $AVD_NAME"
                break
            fi
        done
    fi
    
    # If still default (no tablet or Pixel), show it
    if [ "$AVD_NAME" == "${AVDS[0]}" ]; then
        echo "Auto-selected: $AVD_NAME"
    fi
fi

echo ""
echo "Starting emulator: $AVD_NAME..."
echo "This will take 30-60 seconds..."

# Start emulator in background
$EMULATOR -avd "$AVD_NAME" -no-snapshot-load > /dev/null 2>&1 &

# Wait for emulator to boot
echo "Waiting for emulator to boot..."
$ADB wait-for-device

# Wait for boot to complete
while [ "$($ADB shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    echo "Booting..."
    sleep 2
done

echo ""
echo "✓ Emulator is ready!"
$ADB devices
