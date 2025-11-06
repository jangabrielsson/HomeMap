# 🖥️ Creating a Tablet Emulator in Android Studio

## Finding Device Manager

In the **latest Android Studio** (Ladybug 2024.2+), Device Manager is here:

### Option 1: Top-Right Corner
Look for the **📱 phone icon** in the top-right toolbar, next to the run/debug buttons. Click it.

### Option 2: More Options Menu
1. Click the **three dots (⋮)** or **hamburger menu (≡)** at the top
2. Look for **"Device Manager"** in the dropdown

### Option 3: Search (Fastest!)
1. Press **⌘ + Shift + A** (Mac) or **Ctrl + Shift + A** (Windows/Linux)
2. Type: `device manager`
3. Click on **"Device Manager"** in the results

### Option 4: Welcome Screen
If you just opened Android Studio:
1. On the welcome screen, look for **"More Actions"** dropdown at bottom
2. Click **"Virtual Device Manager"**

---

## Creating a Tablet Emulator

Once Device Manager is open:

### Step 1: Create Device
Click the **"+"** button or **"Create Device"** button

### Step 2: Choose Hardware
1. In the left sidebar, select **"Tablet"** category
2. Choose **"Pixel Tablet"** (recommended for HomeMap)
   - Screen: 10.95" 2560×1600
   - Good for testing tablet layouts
3. Click **Next**

### Step 3: Select System Image
1. Select the **"Recommended"** tab
2. Choose **API 34** (Android 14) or **API 36** (Android 15)
3. Make sure it's **arm64-v8a** architecture (for Apple Silicon Macs)
4. If you see a **Download** link, click it and wait for download
5. Click **Next**

### Step 4: Verify Configuration
1. Name: **HomeMap_Tablet** (or keep default)
2. Startup orientation: **Landscape** (recommended for tablets)
3. Click **Finish**

---

## Starting Your Tablet

After creation:

### From Android Studio Device Manager
1. Find your tablet in the device list
2. Click the **▶️ play button** next to it

### From Command Line
```bash
./scripts/android-start-emulator.sh
```

The script will automatically detect and start your tablet.

---

## Troubleshooting

### "I still can't find Device Manager"
Try this terminal command to open it:
```bash
open -a "Android Studio"
# Then press: Cmd + Shift + A
# Type: device manager
```

### "Download button is disabled"
You need to install **Android SDK Command-line Tools**:
1. In Android Studio: **Tools → SDK Manager**
2. Click **SDK Tools** tab
3. Check ✅ **Android SDK Command-line Tools**
4. Click **Apply**

### "System image download fails"
1. Go to **Tools → SDK Manager**
2. Click **SDK Platforms** tab
3. Check ✅ **Android 14.0 (API 34)**
4. Click **Apply**

---

## Quick Visual Guide

```
Android Studio Window
┌──────────────────────────────────────────────────┐
│ File  Edit  View  Tools                      📱 │ ← Click this phone icon!
├──────────────────────────────────────────────────┤
│                                                  │
│  Or press: Cmd + Shift + A                      │
│  Type: "device manager"                          │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## After Creating the Tablet

Run these commands:

```bash
# Check it was created
$ANDROID_HOME/emulator/emulator -list-avds

# Start it
./scripts/android-start-emulator.sh

# Build and run HomeMap
./scripts/android-rebuild.sh
```

---

## Alternative: Use Your Existing Emulator

You already have: **Medium_Phone_API_36.1**

While this is a phone, you can still use it to test HomeMap:

```bash
./scripts/android-start-emulator.sh
./scripts/android-rebuild.sh
```

HomeMap will work fine on a phone emulator for development!

---

## Need Help?

If you're still stuck, you can:
1. Open Android Studio
2. Take a screenshot of the main window
3. I'll point out exactly where Device Manager is in your version
