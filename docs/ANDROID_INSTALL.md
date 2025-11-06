# 🤖 Android Setup Guide for HomeMap

Complete step-by-step guide to set up Android development for HomeMap on macOS.

## Prerequisites

- macOS (Apple Silicon or Intel)
- ~15GB free disk space for Android Studio and SDK
- Terminal access

---

## Part 1: Install Android Studio

### 1.1 Download and Install

1. **Download Android Studio**
   - Visit: https://developer.android.com/studio
   - Download the latest version (Ladybug or newer)
   - Open the `.dmg` file and drag Android Studio to Applications

2. **First Launch Setup**
   - Open Android Studio from Applications
   - Follow the setup wizard:
     - Choose "Standard" installation
     - Accept license agreements
     - Let it download SDK components (this takes 10-15 minutes)

### 1.2 Install NDK (Native Development Kit)

The NDK is required for building Rust code for Android.

1. Open Android Studio
2. Go to **Tools → SDK Manager**
3. Click the **SDK Tools** tab
4. Check the boxes:
   - ✅ **NDK (Side by side)** - version 29.x or later
   - ✅ **Android SDK Command-line Tools**
   - ✅ **Android SDK Platform-Tools**
5. Click **Apply** to install
6. Wait for installation to complete

### 1.3 Create Android Virtual Device (AVD)

You need an emulator to test the app.

1. In Android Studio, go to **Tools → Device Manager**
2. Click **Create Device**
3. Choose a device (recommended: **Pixel 6** or newer)
4. Select a system image:
   - Choose **API 34** (Android 14) or newer
   - Use **arm64-v8a** for Apple Silicon Macs
   - Use **x86_64** for Intel Macs
5. Click **Finish**

---

## Part 2: Configure Environment

### 2.1 Run Environment Setup

After Android Studio installation completes:

```bash
# Run the automated setup script
./scripts/setup-android-env.sh

# This will detect your Android Studio installation and show you
# the environment variables to add to ~/.zshrc
```

### 2.2 Add Environment Variables

The script will output something like this:

```bash
# Android Development Environment
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_NDK_HOME="$HOME/Library/Android/sdk/ndk/29.0.14206865"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
export PATH="$JAVA_HOME/bin:$PATH"
```

**Option A: Manual Addition**
```bash
# Open your shell config
nano ~/.zshrc

# Paste the environment variables at the end
# Save (Ctrl+O, Enter, Ctrl+X)

# Reload your shell configuration
source ~/.zshrc
```

**Option B: Automatic Addition**
```bash
# Let the script add them automatically
./scripts/setup-android-env.sh --auto

# Then reload
source ~/.zshrc
```

### 2.3 Verify Environment

```bash
# Check that everything is set
echo $ANDROID_HOME
echo $ANDROID_NDK_HOME  
echo $JAVA_HOME

# Verify Java works
java -version

# Verify adb works
adb version
```

You should see valid paths and version information.

---

## Part 3: Install Rust Android Targets

Rust needs cross-compilation targets for Android architectures.

```bash
# Install all Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

This installs support for:
- **aarch64-linux-android**: ARM64 devices/emulators (primary, 95%+ of devices)
- **armv7-linux-androideabi**: Older ARM32 devices
- **i686-linux-android**: x86 emulators
- **x86_64-linux-android**: x86_64 emulators

### Verify Installation

```bash
rustup target list --installed | grep android
```

You should see all four targets listed.

---

## Part 4: Initialize Android Project

Now that everything is installed, initialize the Tauri Android project:

```bash
# Run the initialization script
./scripts/init-android.sh
```

This will:
1. ✅ Check all prerequisites
2. ✅ Verify Rust targets
3. ✅ Initialize the Tauri Android project
4. ✅ Create the Android project structure at `src-tauri/gen/android`

---

## Part 5: Build and Run

### First Build

```bash
# Start the Android emulator
./scripts/android-start-emulator.sh

# Wait for emulator to fully boot (30-60 seconds)

# Build and install the app
./scripts/android-build.sh

# Run the app
./scripts/android-run.sh
```

### Quick Rebuild Script

For development, use the all-in-one rebuild script:

```bash
./scripts/android-rebuild.sh
```

This will:
- Clean previous builds
- Rebuild the Rust library
- Rebuild the Android APK
- Install on emulator
- Launch the app

---

## Troubleshooting

### Issue: "Android Studio not found"

**Solution:** Make sure Android Studio is in your Applications folder:
```bash
ls "/Applications/Android Studio.app"
```

### Issue: "NDK not found"

**Solution:** Install NDK via Android Studio:
1. Tools → SDK Manager
2. SDK Tools tab
3. Check "NDK (Side by side)"
4. Apply

### Issue: "ANDROID_HOME not set"

**Solution:** Run the environment setup:
```bash
./scripts/setup-android-env.sh --auto
source ~/.zshrc
```

### Issue: "No emulators found"

**Solution:** Create an AVD in Android Studio:
1. Tools → Device Manager
2. Create Device
3. Choose Pixel 6 + API 34

### Issue: "Build fails with linker errors"

**Solution:** Check your `.cargo/config.toml` has the correct NDK paths:
```bash
cat .cargo/config.toml
```

The paths should match your `$ANDROID_NDK_HOME`. If they don't, update them or delete the file and re-run init.

### Issue: "Gradle build fails"

**Solution:** Clear Gradle cache and rebuild:
```bash
./scripts/android-clear-data.sh
./scripts/android-rebuild.sh
```

---

## Build Scripts Reference

| Script | Purpose |
|--------|---------|
| `setup-android-env.sh` | Configure environment variables |
| `init-android.sh` | Initialize Android project |
| `android-start-emulator.sh` | Start Android emulator |
| `android-build.sh` | Build APK |
| `android-run.sh` | Install and run on emulator |
| `android-rebuild.sh` | Clean + build + run (one command) |
| `android-clear-data.sh` | Clear app data on emulator |
| `android-logs.sh` | View app logs |

---

## Development Workflow

### Typical Development Cycle

```bash
# 1. Start emulator (do this once per session)
./scripts/android-start-emulator.sh

# 2. Make code changes in your editor

# 3. Rebuild and test
./scripts/android-rebuild.sh

# 4. Check logs if needed
./scripts/android-logs.sh
```

### Build Times

- **First build**: 5-10 minutes (compiles all dependencies)
- **Incremental builds**: 30-60 seconds (only changed code)
- **Clean builds**: 2-3 minutes

For faster development builds, you can build for just ARM64:
```bash
cd src-tauri
cargo tauri android build --target aarch64
```

---

## Architecture Notes

### Build Targets Explained

- **Development builds** (default): Only `aarch64-linux-android`
  - Covers 95%+ of modern devices
  - Works with Apple Silicon and newer Intel emulators
  - 4x faster compilation

- **Production builds**: All four targets
  - Maximum device compatibility
  - Includes older ARM32 devices
  - Includes x86 emulators (rarely used)

### Project Structure

```
src-tauri/
├── gen/
│   └── android/          # Generated Android project
│       ├── app/          # Android app module
│       ├── build.gradle  # Gradle build config
│       └── gradle/       # Gradle wrapper
├── tauri.android.conf.json  # Android-specific Tauri config
└── Cargo.toml           # Rust dependencies
```

---

## Next Steps

Once you have a successful build:

1. **Test on Real Device**: Enable USB debugging and connect via USB
2. **Release Build**: Build signed APK for distribution
3. **CI/CD**: Set up GitHub Actions for automated builds

See other docs:
- `RELEASE_READY.md` - For creating release builds
- `GITHUB_SECRETS_SETUP.md` - For CI/CD setup

---

## Quick Reference

### Essential Commands

```bash
# Check environment
echo $ANDROID_HOME && echo $ANDROID_NDK_HOME && echo $JAVA_HOME

# List available emulators
emulator -list-avds

# Check Rust targets
rustup target list --installed | grep android

# Build for specific architecture
cargo tauri android build --target aarch64

# View device logs
adb logcat | grep HomeMap
```

### Useful Android Studio Features

- **Logcat**: View → Tool Windows → Logcat (for detailed logs)
- **Device Manager**: Tools → Device Manager (manage emulators)
- **SDK Manager**: Tools → SDK Manager (update SDK/NDK)
- **Gradle Sync**: File → Sync Project with Gradle Files (after config changes)

---

## Support

If you run into issues:

1. Check the troubleshooting section above
2. Review Android Studio's error messages
3. Check `./scripts/android-logs.sh` for runtime errors
4. Verify environment variables are set correctly

**Common gotchas:**
- Forgot to run `source ~/.zshrc` after setting environment variables
- NDK version mismatch in `.cargo/config.toml`
- Emulator not fully booted before running build
- Android Studio needs to be opened at least once to initialize SDK
