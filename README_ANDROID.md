# 🤖 Android Development - Setup Summary

## What You Need to Install

### 1. Android Studio (~10 GB)
- **Download**: https://developer.android.com/studio
- **Includes**: Java, Android SDK, Build Tools
- **Must Install Separately**: NDK (Native Development Kit)

### 2. Rust Android Targets (~100 MB)
Already installed! ✅
- aarch64-linux-android
- armv7-linux-androideabi
- i686-linux-android
- x86_64-linux-android

### 3. Environment Variables
Run after Android Studio installation:
```bash
./scripts/setup-android-env.sh --auto
source ~/.zshrc
```

---

## Step-by-Step Process

### Option 1: Follow the Interactive Guide

```bash
# 1. Install Android Studio manually from website
#    https://developer.android.com/studio

# 2. Open Android Studio and install NDK:
#    Tools → SDK Manager → SDK Tools → Check "NDK (Side by side)"

# 3. Create an emulator:
#    Tools → Device Manager → Create Device → Pixel 6 + API 34

# 4. Set up environment
./scripts/setup-android-env.sh --auto
source ~/.zshrc

# 5. Initialize Android project
./scripts/init-android.sh

# 6. First build
./scripts/android-start-emulator.sh
./scripts/android-rebuild.sh
```

### Option 2: Follow the Checklist

Open and follow: **`docs/ANDROID_CHECKLIST.md`**

### Option 3: Read Complete Documentation

Open: **`docs/ANDROID_INSTALL.md`** for detailed explanations

---

## Scripts Available

### Setup Scripts
- `setup-android-env.sh` - Configure environment variables
- `init-android.sh` - Initialize Tauri Android project

### Development Scripts (already exist)
- `android-start-emulator.sh` - Start emulator
- `android-build.sh` - Build APK
- `android-run.sh` - Install and run
- `android-rebuild.sh` - Full rebuild cycle
- `android-clear-data.sh` - Clear app data
- `android-logs.sh` - View logs

---

## Current Status

✅ **Rust Android targets installed**
- All 4 architectures ready

✅ **Cargo configuration ready**
- `.cargo/config.toml` configured for NDK

✅ **Build scripts ready**
- All scripts in `scripts/` folder

❌ **Android Studio not installed yet**
- Need to download and install

❌ **Environment variables not set**
- Will be set after Android Studio installation

❌ **Android project not initialized**
- Will initialize after environment setup

---

## What Happens When You Run `init-android.sh`?

The script will:
1. ✅ Check Android Studio is installed
2. ✅ Check environment variables are set
3. ✅ Check NDK is installed
4. ✅ Check Rust targets are installed
5. 🔧 Run `cargo tauri android init`
6. ✅ Create `src-tauri/gen/android/` directory
7. ✅ Generate Android project files
8. 📱 Ready to build!

---

## Estimated Time

| Task | Time |
|------|------|
| Download Android Studio | 5-10 min (depending on internet) |
| Install Android Studio | 2-3 min |
| Android Studio setup wizard | 10-15 min (downloads SDK) |
| Install NDK | 3-5 min |
| Create AVD (emulator) | 5-10 min (downloads system image) |
| Configure environment | 1 min |
| Initialize Android project | 1-2 min |
| **First build** | 5-10 min |
| **Total first-time setup** | **~30-45 minutes** |

Subsequent builds: **30-60 seconds**

---

## Disk Space Required

- Android Studio: ~3 GB
- Android SDK: ~3-4 GB
- NDK: ~2 GB
- System images (emulator): ~1-2 GB per image
- Build artifacts: ~500 MB
- **Total: ~10-12 GB**

---

## Architecture Overview

```
macOS (your machine)
├── Android Studio
│   ├── Java (bundled)
│   ├── Android SDK
│   │   ├── platform-tools (adb)
│   │   ├── build-tools
│   │   └── platforms
│   └── NDK (C/C++ cross-compiler)
│
├── Rust
│   └── Android targets (cross-compilation)
│
└── HomeMap Project
    ├── src/ (HTML/CSS/JS)
    └── src-tauri/
        ├── src/ (Rust backend)
        └── gen/android/ (Generated Android project)
```

Build process:
1. **Rust** → Compiles to `.so` library for Android
2. **NDK** → Links native libraries
3. **Gradle** → Packages into APK
4. **Android Studio** → Signs and installs

---

## Quick Reference Card

### First Time Setup
```bash
# After installing Android Studio:
./scripts/setup-android-env.sh --auto
source ~/.zshrc
./scripts/init-android.sh
```

### Daily Development
```bash
./scripts/android-start-emulator.sh  # Once per session
./scripts/android-rebuild.sh          # After code changes
```

### Troubleshooting
```bash
./scripts/android-clear-data.sh      # Clear app data
./scripts/android-logs.sh            # View logs
```

---

## Next Steps

1. **Install Android Studio**
   - Download from https://developer.android.com/studio
   - Install to Applications folder
   - Complete setup wizard

2. **Install NDK**
   - Open Android Studio
   - Tools → SDK Manager
   - SDK Tools tab
   - Check "NDK (Side by side)"
   - Click Apply

3. **Create Emulator**
   - Tools → Device Manager
   - Create Device
   - Pixel 6 + API 34

4. **Configure Environment**
   ```bash
   ./scripts/setup-android-env.sh --auto
   source ~/.zshrc
   ```

5. **Initialize Project**
   ```bash
   ./scripts/init-android.sh
   ```

6. **First Build**
   ```bash
   ./scripts/android-start-emulator.sh
   ./scripts/android-rebuild.sh
   ```

---

## Documentation Files

| File | Purpose |
|------|---------|
| `ANDROID_CHECKLIST.md` | ✅ Quick setup checklist |
| `ANDROID_INSTALL.md` | 📖 Complete installation guide |
| `ANDROID_SETUP.md` | 🔧 Technical details (from other machine) |
| `README_ANDROID.md` | 📄 This summary file |

Start with the **CHECKLIST**, refer to the **INSTALL** guide for details.

---

## Support

If something doesn't work:

1. Check you completed all checklist items
2. Verify environment variables: `echo $ANDROID_HOME`
3. Check Android Studio has SDK and NDK installed
4. Try the troubleshooting section in ANDROID_INSTALL.md
5. Clear and rebuild: `./scripts/android-clear-data.sh && ./scripts/android-rebuild.sh`

Most issues are due to:
- ❌ Forgot to run `source ~/.zshrc` after setting environment
- ❌ NDK not installed via Android Studio
- ❌ Emulator not fully booted before building
- ❌ Android Studio never opened (SDK not initialized)
