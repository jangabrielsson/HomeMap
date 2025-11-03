# Android Development Setup Guide

✅ **Setup Complete!** Android development is now fully configured.

## Quick Start

```bash
# Start emulator
./scripts/android-start-emulator.sh

# Build and run
./scripts/android-build.sh
./scripts/android-run.sh

# Or do everything at once
./scripts/android-rebuild.sh
```

## What Was Done

### 1. Android Studio & SDK
- Installed Android Studio Ladybug
- Android SDK at `~/Library/Android/sdk`
- NDK 29.0.14206865 installed
- Java 21 (bundled with Android Studio)

### 2. Rust Android Targets
```bash
rustup target list --installed | grep android
# aarch64-linux-android (ARM64 devices/emulators) ← PRIMARY for development
# armv7-linux-androideabi (ARM32 older devices)
# i686-linux-android (x86 emulators)
# x86_64-linux-android (x86_64 emulators)
```

**Development builds** use only `aarch64-linux-android` for 4x faster compilation (~50s vs 7+ minutes).
This covers 95%+ of modern devices and Apple Silicon emulators.

### 3. Environment Variables
Added to `~/.zshrc`:
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_NDK_HOME="$HOME/Library/Android/sdk/ndk/29.0.14206865"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
export PATH="$JAVA_HOME/bin:$PATH"
```

### 4. Cargo NDK Configuration
Created `.cargo/config.toml` with proper toolchain settings for all Android targets.

### 5. Tauri Android Project
- Initialized with `cargo tauri android init`
- Created `tauri.android.conf.json`
- Package: `com.gabrielsson.homemap`

### 6. TLS Configuration
- Used `rustls-tls` instead of OpenSSL for mobile (cleaner cross-compilation)
- Modified `Cargo.toml` for platform-specific reqwest features

### 7. File System Paths
- Android uses `/data/data/com.gabrielsson.homemap/files/homemapdata`
- Platform-specific path handling in `lib.rs`

### 8. Android Virtual Device
- Created: Pixel Tablet emulator
- System Image: Android API 34 (UpsideDownCake)

## Helper Scripts

All scripts are in `./scripts/`:

- **android-start-emulator.sh** - Start the Pixel Tablet emulator
- **android-build.sh** - Build debug APK
- **android-run.sh** - Install and run on device/emulator  
- **android-clear-data.sh** - Clear app data
- **android-logs.sh** - View app logs
- **android-rebuild.sh** - Full rebuild pipeline

## Development Workflow

```bash
# 1. Start emulator (if not running)
./scripts/android-start-emulator.sh

# 2. Make code changes

# 3. Build
./scripts/android-build.sh

# 4. Install and run
./scripts/android-run.sh

# 5. View logs
./scripts/android-logs.sh
# Or: adb logcat | grep -i "homemap\|tauri"
```

## Build Outputs

### Debug Build (for development)
- APK: `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
- Size: ~354MB (optimized for single architecture)
- Build time: ~50 seconds
- Target: `aarch64-linux-android` (ARM64 for modern devices/emulators)
- Signed with debug key (auto-generated)

**Note:** For faster development builds, we only build for `aarch64` (ARM64) which works on:
- Apple Silicon Mac emulators
- Modern Android tablets and phones (95%+ of devices)
- See `scripts/android-build.sh` for `--target aarch64` flag

### Release Build (for production)
```bash
cargo tauri android build  # Creates unsigned release APK
```
- APK: `src-tauri/gen/android/app/build/outputs/apk/universal/release/`
- Builds all architectures: aarch64, armv7, x86_64, i686
- Larger size but maximum compatibility
- Needs signing for distribution

## Project Structure

```
src-tauri/
  gen/android/          # Generated Android project
    app/
      src/main/
        AndroidManifest.xml
        java/           # Java/Kotlin code
        jniLibs/        # Native libraries (Rust)
        res/            # Resources
    build.gradle.kts
    settings.gradle
  tauri.android.conf.json  # Android-specific config
  .cargo/config.toml       # NDK toolchain config
```

## Troubleshooting

### "aarch64-linux-android-ranlib: command not found"
✅ Fixed with `.cargo/config.toml` specifying `llvm-ranlib`

### "Could not find data directory"
✅ Fixed with platform-specific paths in `lib.rs`

### "OpenSSL build failed"
✅ Fixed by using `rustls-tls` instead of OpenSSL

### Emulator not starting
```bash
emulator -list-avds  # List available AVDs
emulator -avd Pixel_Tablet -no-snapshot-load
```

### App crashes on launch
```bash
./scripts/android-logs.sh
# Look for Rust panics or errors
```

### Clean everything
```bash
cd src-tauri
cargo clean
cd gen/android
./gradlew clean
```

## Key Differences from iOS

| Aspect | iOS | Android |
|--------|-----|---------|
| Data Path | `~/Documents/homemapdata` | `/data/data/<package>/files/homemapdata` |
| Build Tool | Xcode + xcodegen | Gradle |
| Emulator | xcrun simctl | emulator (Android SDK) |
| Package Format | .app | .apk / .aab |
| Signing | Code signing cert | Debug keystore (dev) |

## Next Steps

- ✅ App runs on emulator
- ✅ Touch UI works
- ✅ File system access works
- ⏭️ Test on physical Android device
- ⏭️ Set up proper signing for release builds
- ⏭️ Test on different Android versions/devices

## References

- [Tauri Android Guide](https://v2.tauri.app/develop/mobile/android/)
- [Android Developer Docs](https://developer.android.com/docs)
- [Rust Android NDK](https://mozilla.github.io/firefox-browser-architecture/experiments/2017-09-21-rust-on-android.html)

## Step 1: Install Android Studio

1. **Download Android Studio:**
   ```bash
   # Open in browser
   open https://developer.android.com/studio
   ```
   
   Download "Android Studio Ladybug" (or latest version)

2. **Install Android Studio:**
   - Open the downloaded `.dmg` file
   - Drag "Android Studio" to Applications folder
   - Launch Android Studio

3. **Complete Setup Wizard:**
   - Choose "Standard" installation
   - Accept licenses
   - Wait for SDK components to download (~2-3 GB)

4. **Verify installation:**
   ```bash
   ls ~/Library/Android/sdk
   # Should show: build-tools, cmdline-tools, emulator, platform-tools, platforms, etc.
   ```

## Step 2: Set Environment Variables

Add to your `~/.zshrc`:

```bash
echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zshrc
echo 'export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"' >> ~/.zshrc
source ~/.zshrc
```

Verify:
```bash
echo $ANDROID_HOME
adb --version
```

## Step 3: Install Rust Android Targets

```bash
rustup target add aarch64-linux-android    # ARM64 (modern devices/emulators)
rustup target add armv7-linux-androideabi  # ARM32 (older devices)
rustup target add x86_64-linux-android     # x86_64 emulators
```

Verify:
```bash
rustup target list --installed | grep android
```

## Step 4: Install NDK (Native Development Kit)

In Android Studio:
1. Open **Tools → SDK Manager**
2. Go to **SDK Tools** tab
3. Check:
   - ✅ Android SDK Build-Tools
   - ✅ NDK (Side by side)
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator
4. Click **Apply** and wait for installation

Or via command line:
```bash
sdkmanager --install "ndk;26.1.10909125" "build-tools;34.0.0"
```

## Step 5: Create Android Virtual Device (Tablet)

1. In Android Studio: **Tools → Device Manager**
2. Click **Create Device**
3. Choose **Tablet** category
4. Select **Pixel Tablet** (or similar large screen device)
5. Choose system image:
   - Select **Tiramisu (API 33)** or **UpsideDownCake (API 34)**
   - Click **Download** if not already installed
6. Click **Finish**

Verify from command line:
```bash
emulator -list-avds
```

## Step 6: Initialize Tauri Android Project

```bash
cd /path/to/HomeMap

# Initialize Android support
cargo tauri android init
```

This will:
- Create `src-tauri/gen/android/` directory
- Generate Android project structure
- Create `AndroidManifest.xml`
- Set up Gradle build files

You'll be prompted for:
- **App name:** HomeMap
- **Package name:** com.gabrielsson.homemap
- **Target SDK:** 34 (or latest)
- **Minimum SDK:** 24 (Android 7.0)

## Step 7: Configure Android Project

The generated files should work, but verify:

### `src-tauri/tauri.conf.json`
Should already have:
```json
{
  "bundle": {
    "android": {
      "minSdkVersion": 24
    }
  }
}
```

### Resources to Bundle
Similar to iOS, ensure `homemapdata.example` gets bundled. This should be handled automatically by Tauri's resource bundling.

## Step 8: First Build

```bash
# Start emulator (if not running)
emulator -avd Pixel_Tablet &

# Wait for emulator to boot, then build and run
cargo tauri android dev
```

**Note:** First build can take 10-15 minutes (Gradle downloading dependencies).

## Step 9: Create Build Scripts

Similar to iOS scripts, we'll create Android helpers:

```bash
./scripts/android-build.sh    # Build release APK
./scripts/android-run.sh      # Install and run on emulator
./scripts/android-rebuild.sh  # Full rebuild
```

## Troubleshooting

### Data Directory Issues (FIXED in v0.1.28+)

**Problem**: "Could not find data directory" or broken floor image

**Root Causes** (both fixed):
1. Welcome dialog was blocking `loadHomeMapConfig()` with `await`
   - **Fixed**: Changed to non-blocking `.then()` callback in `src/script.js`
2. `dirs::data_dir()` returns None on Android  
   - **Fixed**: Platform-specific paths in `src-tauri/src/lib.rs` using `#[cfg(target_os = "android")]`

**Current Status**: ✅ Fully functional - directory created automatically on first launch

**Data Paths on Android**:
- App data: `/data/data/com.gabrielsson.homemap/files/homemapdata/`
- Config: `/data/data/com.gabrielsson.homemap/files/homemapdata/config.json`
- Images: `/data/data/com.gabrielsson.homemap/files/homemapdata/images/`

**Verification**:
```bash
# Check if directory exists
adb shell "run-as com.gabrielsson.homemap ls -la /data/data/com.gabrielsson.homemap/files/homemapdata"

# View config
adb shell "run-as com.gabrielsson.homemap cat /data/data/com.gabrielsson.homemap/files/homemapdata/config.json"
```

### Template Resources Extraction

**Status**: ✅ **FULLY IMPLEMENTED**

The `homemapdata.example` folder is bundled in the Android APK at `assets/_up_/homemapdata.example` and automatically extracted on first launch.

**How It Works:**

1. **Asset Bundling** - Template files are bundled during build:
   - Location in APK: `assets/_up_/homemapdata.example/`
   - 38 files: widget definitions, icons, floor images, config
   - See `homemapdata.example/asset-manifest.json` for full list

2. **Dynamic APK Path Discovery** - At runtime, the app:
   - Reads `/proc/self/maps` to find actual APK path
   - Handles Android 10+ random hash paths (e.g., `/data/app/~~HASH~~/package/base.apk`)
   - Opens APK as zip file using Rust `zip` crate

3. **Asset Extraction** - On first launch:
   - JavaScript fetches `asset-manifest.json` to get file list
   - Calls Rust `read_bundled_asset` for each file
   - Rust reads from APK zip, returns base64-encoded bytes
   - JavaScript calls `write_file_base64` to write to filesystem
   - All 38 files extracted to `/data/data/com.gabrielsson.homemap/files/homemapdata/`

4. **Version Tracking** - On subsequent launches:
   - Checks localStorage for `bundled_assets_version`
   - If version changed, re-extracts in background (non-blocking)
   - Ensures built-in widgets/icons stay up-to-date

**Extracted Files Include:**
- ✅ 14 built-in widget definitions (JSON)
- ✅ 26 device icon sets (SVG/PNG)
- ✅ 3 default floor images (PNG)
- ✅ Template config.json
- ✅ Asset manifest and README

**Verification:**
```bash
# Check extracted files
adb shell "run-as com.gabrielsson.homemap find /data/data/com.gabrielsson.homemap/files/homemapdata -type f"

# View logs during extraction
adb logcat | grep -E "(Asset copy|Successfully read|Using APK path)"
```

**Implementation Details:**
- Code: `src-tauri/src/lib.rs` - `read_bundled_asset()` function
- Frontend: `src/script.js` - `copyBundledAssetsIfNeeded()` function
- Asset list: `homemapdata.example/asset-manifest.json`
- Generation: `scripts/generate-asset-manifest.sh`

### "ANDROID_HOME not set"
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

### "NDK not found"
Install via SDK Manager or:
```bash
sdkmanager --install "ndk;26.1.10909125"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/26.1.10909125"
```

### Emulator won't start
```bash
# List available AVDs
emulator -list-avds

# Start specific AVD
emulator -avd Pixel_Tablet -no-snapshot-load
```

### Gradle build fails
```bash
# Clean Gradle cache
cd src-tauri/gen/android
./gradlew clean

# Or nuclear option:
rm -rf ~/.gradle/caches/
```

### "Unable to find Java"
Android Studio includes Java, but you may need to set JAVA_HOME:
```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

## File Locations

### Development Files
- Android project: `src-tauri/gen/android/`
- Manifest: `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
- Resources: `src-tauri/gen/android/app/src/main/res/`

### Build Outputs
- Debug APK: `src-tauri/gen/android/app/build/outputs/apk/debug/`
- Release APK: `src-tauri/gen/android/app/build/outputs/apk/release/`
- AAB (Play Store): `src-tauri/gen/android/app/build/outputs/bundle/release/`

### Runtime on Device
- App data: `/data/data/com.gabrielsson.homemap/`
- Files: `/data/data/com.gabrielsson.homemap/files/`

## Next Steps

Once basic build works:
1. Test on emulator
2. Verify HC3 API calls work
3. Test touch UI responsiveness
4. Check file paths for `homemapdata` on Android
5. Create build scripts for automation

## References

- [Tauri Android Guide](https://v2.tauri.app/develop/mobile/android/)
- [Android Developer Docs](https://developer.android.com/docs)
- [Android Studio Download](https://developer.android.com/studio)
