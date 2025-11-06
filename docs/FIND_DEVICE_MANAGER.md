# 📱 Finding Device Manager in Android Studio

The Device Manager location varies by Android Studio version. Here's how to find it:

## Method 1: Top Menu Bar (Most Common)

**Tools → Device Manager**

This should work in most versions of Android Studio.

## Method 2: Toolbar Button

Look for the **Device Manager icon** in the top-right toolbar:
- It looks like a phone/tablet icon
- Usually near the top-right corner of the window
- Click it to open Device Manager

## Method 3: Quick Search

1. Press **⌘ + Shift + A** (Mac) or **Ctrl + Shift + A** (Windows/Linux)
2. Type "Device Manager"
3. Click on "Device Manager" in the results

## Method 4: View Menu (Newer Versions)

**View → Tool Windows → Device Manager**

## Method 5: Using Command Line (Alternative)

If you can't find Device Manager, you can create an emulator from the command line:

```bash
# List available system images
sdkmanager --list | grep system-images

# Install a system image (if needed)
sdkmanager "system-images;android-34;google_apis;arm64-v8a"

# Create an AVD
avdmanager create avd -n HomeMap_Pixel6 -k "system-images;android-34;google_apis;arm64-v8a" -d "pixel_6"

# List created AVDs
avdmanager list avd

# Start the emulator
emulator -avd HomeMap_Pixel6 &
```

## Quick Setup Script

I'll create a script to help you create an emulator from the command line:

```bash
./scripts/android-create-emulator.sh
```

---

## What Version Do You Have?

To check your Android Studio version:
1. Open Android Studio
2. Go to **Android Studio → About Android Studio** (Mac) or **Help → About** (Windows/Linux)
3. Look at the version number

Recent versions:
- **Ladybug** (2024.2.x) - Latest as of 2024
- **Koala** (2024.1.x)
- **Jellyfish** (2023.3.x)

---

## Already Have an Emulator?

Check if you already have emulators installed:

```bash
# List existing AVDs
emulator -list-avds
```

If you see a list of emulator names, you can start one directly:

```bash
# Start specific emulator
emulator -avd <name-from-list> &

# Or use the script
./scripts/android-start-emulator.sh
```

---

## Still Can't Find It?

Let me create a command-line based setup script for you that doesn't require Device Manager.
